import 'server-only';
import { ZodSchema } from 'zod';
import { EventProfile } from '@/domain/schemas/profile';
import { PlanDiff } from '@/domain/rules/replan';
import { LLMProvider, ProviderError, ProviderName } from './provider';
import { JarvisProvider } from './jarvis';
import { GeminiProvider } from './gemini';
import { CircuitBreaker, jarvisBreaker, geminiBreaker } from '@/server/security/circuitBreaker';
import { AICache, globalAICache, buildCacheKey } from './cache';
import { GeminiCritic, CriticVerdict } from './critic';
import { extractJsonObject } from './jsonExtract';
import { validateOutput, ValidationContext } from './validators';
import { buildRepairPrompt, PROMPT_VERSION } from './prompts';
import { DeterministicFallback } from './fallback';
import { getEnv } from '@/server/env';
import { logger } from '@/server/security/logger';

export interface AIMetadata {
  provider: ProviderName;
  attempts: number;
  repaired: boolean;
  fallbackReason?: string;
  latencyMs: number;
  promptVersion: string;
  cached: boolean;
  criticVerdict?: CriticVerdict;
  skippedProviders?: Array<{ provider: string; reason: string }>;
}

export interface SectionExecutionResult<T> {
  data: T;
  meta: AIMetadata;
}

export interface FailoverChainOptions {
  jarvis?: JarvisProvider;
  gemini?: GeminiProvider;
  jarvisBreaker?: CircuitBreaker;
  geminiBreaker?: CircuitBreaker;
  cache?: AICache;
  critic?: GeminiCritic;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class FailoverChain {
  private readonly jarvis: JarvisProvider;
  private readonly gemini: GeminiProvider;
  private readonly jBreaker: CircuitBreaker;
  private readonly gBreaker: CircuitBreaker;
  private readonly cache: AICache;
  private readonly critic: GeminiCritic;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options?: FailoverChainOptions) {
    this.jarvis = options?.jarvis ?? new JarvisProvider();
    this.gemini = options?.gemini ?? new GeminiProvider();
    this.jBreaker = options?.jarvisBreaker ?? jarvisBreaker;
    this.gBreaker = options?.geminiBreaker ?? geminiBreaker;
    this.cache = options?.cache ?? globalAICache;
    this.critic = options?.critic ?? new GeminiCritic({ gemini: this.gemini });
    this.now = options?.now ?? (() => Date.now());
    this.sleep = options?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /**
   * Executes a structured section through the failover chain:
   * Jarvis (primary) -> Gemini (failover) -> Template Fallback (deterministic).
   */
  async executeSection<T>(params: {
    section: 'ideas' | 'category_tips' | 'menu' | 'narrate_diff' | 'chat_intent';
    schema: ZodSchema<T>;
    promptBuilder: () => { system: string; user: string };
    fallbackGetter: () => T;
    validationContext?: ValidationContext;
    profile?: EventProfile;
    diff?: PlanDiff;
    forceProvider?: string | null;
    requestId?: string;
  }): Promise<SectionExecutionResult<T>> {
    const startTime = this.now();
    const reqId = params.requestId || 'chain_exec';

    // 1. Build cache key and check cache
    const promptData = params.promptBuilder();
    const cacheKey = buildCacheKey(
      params.section,
      {
        profile: params.profile,
        diff: params.diff?.summaryFacts,
        user: promptData.user,
      },
      PROMPT_VERSION,
      'jarvis:gemma-4-31b-it;gemini'
    );

    // If override header is present and allowed, honor it
    let allowOverride = false;
    try {
      allowOverride = getEnv().ALLOW_PROVIDER_OVERRIDE;
    } catch {
      // Unit test fallback
    }

    const forced =
      allowOverride && params.forceProvider ? params.forceProvider.toLowerCase().trim() : null;

    if (!forced) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) {
        return {
          data: cached,
          meta: {
            provider: 'jarvis',
            attempts: 0,
            repaired: false,
            latencyMs: this.now() - startTime,
            promptVersion: PROMPT_VERSION,
            cached: true,
          },
        };
      }
    }

    let attempts = 0;
    let wasRepaired = false;
    let fallbackReason: string | undefined;

    const totalDeadlineMs = (() => {
      try {
        return getEnv().AI_TOTAL_DEADLINE_MS ?? 15000;
      } catch {
        return 15000;
      }
    })();
    const deadline = startTime + totalDeadlineMs;

    // Define provider candidate sequence
    interface Candidate {
      name: 'jarvis' | 'gemini';
      provider: LLMProvider;
      breaker: CircuitBreaker;
      isConfigured: () => boolean;
    }

    const allCandidates: Candidate[] = [
      {
        name: 'jarvis',
        provider: this.jarvis,
        breaker: this.jBreaker,
        isConfigured: () => this.jarvis.isConfigured(),
      },
      {
        name: 'gemini',
        provider: this.gemini,
        breaker: this.gBreaker,
        isConfigured: () => this.gemini.isConfigured(),
      },
    ];

    let candidatesToTry = allCandidates;
    if (forced === 'jarvis') {
      candidatesToTry = [allCandidates[0]!];
    } else if (forced === 'gemini') {
      candidatesToTry = [allCandidates[1]!];
    } else if (forced === 'template') {
      candidatesToTry = [];
      fallbackReason = 'Forced template via x-force-provider';
    }

    const skippedProviders: Array<{ provider: string; reason: string }> = [];

    // Try candidates in order
    for (const candidate of candidatesToTry) {
      const remainingMs = deadline - this.now();
      if (remainingMs <= 500) {
        fallbackReason = fallbackReason || `AI request exceeded deadline (${totalDeadlineMs}ms)`;
        break;
      }

      if (!candidate.isConfigured()) {
        skippedProviders.push({ provider: candidate.name, reason: 'not_configured' });
        continue;
      }

      if (!candidate.breaker.canExecute()) {
        skippedProviders.push({ provider: candidate.name, reason: 'circuit_breaker_open' });
        fallbackReason = `${candidate.name} circuit breaker is open (tripped after consecutive failures)`;
        continue;
      }

      // Try candidate with timeout bounded by remaining deadline
      const candidateResult = await this.tryProvider<T>({
        candidate,
        promptData,
        schema: params.schema,
        validationContext: params.validationContext,
        requestId: reqId,
        deadline,
      });

      attempts += candidateResult.attempts;

      if (candidateResult.success && candidateResult.data !== undefined) {
        let finalData = candidateResult.data;
        let criticVerdict: CriticVerdict | undefined;

        // Run Critic if applicable and time permits
        if (
          params.profile &&
          (params.section === 'ideas' || params.section === 'menu') &&
          deadline - this.now() > 2000
        ) {
          criticVerdict = await this.critic.evaluateSections(
            params.profile,
            { [params.section]: finalData },
            reqId
          );

          if (!criticVerdict.approved && criticVerdict.issues.length > 0) {
            const issueText = criticVerdict.issues.map((i) => i.problem).join('; ');
            const criticRepairUser = `${promptData.user}\n\nCRITIC QUALITY FEEDBACK:\n${issueText}\nPlease adjust the items to resolve these cultural/dietary issues.`;

            if (deadline - this.now() > 1500) {
              const retryResult = await this.tryProvider<T>({
                candidate,
                promptData: { system: promptData.system, user: criticRepairUser },
                schema: params.schema,
                validationContext: params.validationContext,
                requestId: reqId,
                deadline,
              });

              if (retryResult.success && retryResult.data !== undefined) {
                finalData = retryResult.data;
                wasRepaired = true;
              }
            }
          }
        }

        // Cache successful outcome
        this.cache.set(cacheKey, finalData);

        return {
          data: finalData,
          meta: {
            provider: candidate.name,
            attempts,
            repaired: wasRepaired || candidateResult.repaired,
            latencyMs: this.now() - startTime,
            promptVersion: PROMPT_VERSION,
            cached: false,
            criticVerdict,
            skippedProviders: skippedProviders.length > 0 ? skippedProviders : undefined,
          },
        };
      }

      // Candidate failed; record reason and continue to next candidate
      fallbackReason = candidateResult.error || `${candidate.name} failed to produce valid output`;
    }

    // All LLM providers failed or unconfigured -> Deterministic Template Fallback
    const fallbackData = params.fallbackGetter();

    return {
      data: fallbackData,
      meta: {
        provider: 'template',
        attempts,
        repaired: false,
        fallbackReason: fallbackReason || 'All providers exhausted or unconfigured',
        latencyMs: this.now() - startTime,
        promptVersion: PROMPT_VERSION,
        cached: false,
        skippedProviders: skippedProviders.length > 0 ? skippedProviders : undefined,
      },
    };
  }

  private async tryProvider<T>(args: {
    candidate: { name: 'jarvis' | 'gemini'; provider: LLMProvider; breaker: CircuitBreaker };
    promptData: { system: string; user: string };
    schema: ZodSchema<T>;
    validationContext?: ValidationContext;
    requestId: string;
    deadline: number;
  }): Promise<{ success: boolean; data?: T; attempts: number; repaired: boolean; error?: string }> {
    const { candidate, promptData, schema, validationContext, requestId, deadline } = args;
    let attempts = 0;

    const remainingMs = deadline - this.now();
    if (remainingMs <= 500) {
      return {
        success: false,
        attempts: 0,
        repaired: false,
        error: 'Deadline exceeded before starting provider call',
      };
    }

    // Attempt 1: Initial call with output budget accommodating reasoning tokens
    attempts++;
    const t0 = this.now();
    try {
      const attemptTimeout = Math.min(Math.max(500, remainingMs), 12000);
      const response = await candidate.provider.generateJson({
        system: promptData.system,
        user: promptData.user,
        schemaName: 'section_output',
        maxTokens: 2500,
        temperature: 0.3,
        timeoutMs: attemptTimeout,
      });
      const attemptLatency = this.now() - t0;

      // Extract balanced JSON
      let parseError: string | null = null;
      let parsed: unknown = null;
      let isTruncated =
        response.finishReason === 'length' || response.finishReason === 'MAX_TOKENS';

      try {
        parsed = extractJsonObject(response.text);
      } catch (e) {
        parseError = (e as Error).message;
        if (parseError.includes('Unbalanced or truncated')) {
          isTruncated = true;
        }
      }

      if (isTruncated) {
        logger.warn({
          requestId,
          route: 'chain',
          provider: candidate.name,
          status: 'warn',
          latencyMs: attemptLatency,
          message: 'LLM attempt truncated',
          extra: {
            attemptNumber: attempts,
            finishReason: response?.finishReason || 'length',
            usage: response?.usage,
            errorKind: 'truncated',
            outputLength: response?.text?.length ?? 0,
          },
        });

        candidate.breaker.recordFailure();
        // Do NOT repeat or repair truncated output per design rules
        return {
          success: false,
          attempts,
          repaired: false,
          error: `${candidate.name} output truncated by token limit (finish_reason: ${response?.finishReason || 'length'})`,
        };
      }

      if (!parseError && parsed !== null) {
        const validation = validateOutput(parsed, schema, validationContext);
        if (validation.valid && validation.data !== undefined) {
          logger.info({
            requestId,
            route: 'chain',
            provider: candidate.name,
            status: 'ok',
            latencyMs: attemptLatency,
            message: 'LLM attempt succeeded',
            extra: {
              attemptNumber: attempts,
              finishReason: response?.finishReason || 'stop',
              usage: response?.usage,
              errorKind: 'none',
              outputLength: response?.text?.length ?? 0,
            },
          });

          candidate.breaker.recordSuccess();
          return { success: true, data: validation.data, attempts, repaired: false };
        }
        parseError = validation.error || 'Output failed schema validation';
      }

      logger.warn({
        requestId,
        route: 'chain',
        provider: candidate.name,
        status: 'warn',
        latencyMs: attemptLatency,
        message: 'LLM attempt produced invalid schema output',
        extra: {
          attemptNumber: attempts,
          finishReason: response?.finishReason,
          usage: response?.usage,
          errorKind: 'bad_output',
          outputLength: response?.text?.length ?? 0,
        },
      });

      // Validation failed (non-truncated) -> Attempt at most 1 repair if time remains
      const repairRemainingMs = deadline - this.now();
      if (repairRemainingMs > 2500) {
        attempts++;
        const tRepair = this.now();
        try {
          const repairUserPrompt = buildRepairPrompt(
            promptData.user,
            response.text,
            parseError || 'Output failed schema validation'
          );

          const repairResponse = await candidate.provider.generateJson({
            system: promptData.system,
            user: repairUserPrompt,
            schemaName: 'section_output_repair',
            maxTokens: 2500,
            temperature: 0.2,
            timeoutMs: Math.min(repairRemainingMs, 8000),
          });
          const repairLatency = this.now() - tRepair;

          const repairParsed = extractJsonObject(repairResponse.text);
          const repairValidation = validateOutput(repairParsed, schema, validationContext);

          if (repairValidation.valid && repairValidation.data !== undefined) {
            logger.info({
              requestId,
              route: 'chain',
              provider: candidate.name,
              status: 'ok',
              latencyMs: repairLatency,
              message: 'LLM repair attempt succeeded',
              extra: {
                attemptNumber: attempts,
                finishReason: repairResponse?.finishReason || 'stop',
                usage: repairResponse?.usage,
                errorKind: 'none',
                outputLength: repairResponse?.text?.length ?? 0,
              },
            });

            candidate.breaker.recordSuccess();
            return { success: true, data: repairValidation.data, attempts, repaired: true };
          }

          logger.warn({
            requestId,
            route: 'chain',
            provider: candidate.name,
            status: 'warn',
            latencyMs: repairLatency,
            message: 'LLM repair attempt failed validation',
            extra: {
              attemptNumber: attempts,
              finishReason: repairResponse?.finishReason,
              usage: repairResponse?.usage,
              errorKind: 'bad_output',
              outputLength: repairResponse?.text?.length ?? 0,
            },
          });
        } catch (repairErr) {
          logger.warn({
            requestId,
            route: 'chain',
            provider: candidate.name,
            status: 'warn',
            latencyMs: this.now() - tRepair,
            message: 'LLM repair attempt error',
            extra: {
              attemptNumber: attempts,
              errorKind: repairErr instanceof ProviderError ? repairErr.kind : 'server',
              outputLength: 0,
            },
          });
        }
      }

      // Both initial and repair failed bad_output validation
      candidate.breaker.recordFailure();
      return {
        success: false,
        attempts,
        repaired: false,
        error: parseError || 'Repair output failed validation',
      };
    } catch (err: unknown) {
      const attemptLatency = this.now() - t0;
      if (err instanceof ProviderError) {
        if (err.kind === 'rate_limit') {
          if (err.isDailyQuota) {
            candidate.breaker.openFor(30 * 60 * 1000); // 30 min cap for daily quota
          } else if (err.retryAfterSeconds && err.retryAfterSeconds > 0) {
            const durationMs = Math.min(err.retryAfterSeconds * 1000, 5 * 60 * 1000); // 5 min cap
            candidate.breaker.openFor(durationMs);
          } else {
            candidate.breaker.recordFailure();
          }
        } else {
          candidate.breaker.recordFailure();
        }

        logger.warn({
          requestId,
          route: 'chain',
          provider: candidate.name,
          status: 'warn',
          latencyMs: attemptLatency,
          message: 'LLM provider error',
          extra: {
            attemptNumber: attempts,
            errorKind: err.kind,
            outputLength: 0,
          },
        });

        // If rate limited with Retry-After, honor once with short sleep only if deadline permits
        if (
          err.kind === 'rate_limit' &&
          err.retryAfterSeconds &&
          err.retryAfterSeconds <= 2 &&
          deadline - this.now() > err.retryAfterSeconds * 1000 + 2000
        ) {
          try {
            await this.sleep(err.retryAfterSeconds * 1000 + 100);
            attempts++;
            const tRetry = this.now();
            const retryRes = await candidate.provider.generateJson({
              system: promptData.system,
              user: promptData.user,
              schemaName: 'section_output_retry',
              maxTokens: 2500,
              timeoutMs: Math.min(deadline - this.now(), 8000),
            });
            const parsed = extractJsonObject(retryRes.text);
            const val = validateOutput(parsed, schema, validationContext);
            if (val.valid && val.data !== undefined) {
              logger.info({
                requestId,
                route: 'chain',
                provider: candidate.name,
                status: 'ok',
                latencyMs: this.now() - tRetry,
                message: 'LLM rate limit retry succeeded',
                extra: {
                  attemptNumber: attempts,
                  finishReason: retryRes?.finishReason || 'stop',
                  usage: retryRes?.usage,
                  errorKind: 'none',
                  outputLength: retryRes?.text?.length ?? 0,
                },
              });

              candidate.breaker.recordSuccess();
              return { success: true, data: val.data, attempts, repaired: false };
            }
          } catch {
            // Retry failed; fall through to failover
          }
        }

        return {
          success: false,
          attempts,
          repaired: false,
          error: `${candidate.name} error: [${err.kind}] ${err.message}`,
        };
      }

      candidate.breaker.recordFailure();
      logger.warn({
        requestId,
        route: 'chain',
        provider: candidate.name,
        status: 'warn',
        latencyMs: attemptLatency,
        message: 'LLM unexpected provider error',
        extra: {
          attemptNumber: attempts,
          errorKind: 'server',
          outputLength: 0,
        },
      });

      return {
        success: false,
        attempts,
        repaired: false,
        error: (err as Error).message || 'Unexpected provider error',
      };
    }
  }
}
