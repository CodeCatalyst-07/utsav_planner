import 'server-only';
import { ZodSchema } from 'zod';
import { EventProfile } from '@/domain/schemas/profile';
import { PlanDiff } from '@/domain/rules/replan';
import { LLMProvider } from './provider';
import { JarvisProvider } from './jarvis';
import { GeminiProvider } from './gemini';
import { CircuitBreaker, jarvisBreaker, geminiBreaker } from '@/server/security/circuitBreaker';
import { AICache, globalAICache, buildCacheKey } from './cache';
import { GeminiCritic, CriticVerdict, CriticStatus } from './critic';
import { ValidationContext } from './validators';
import { PROMPT_VERSION } from './prompts';
import { SECTION_REASONING_POLICY } from './sections';
import { getEnv } from '@/server/env';
import { AIMetadata, SectionExecutionResult, FailoverChainOptions, Candidate } from './chain/types';
import { buildChainMeta } from './chain/metaBuilder';
import { runCandidateAttempt } from './chain/attemptRunner';

export type { AIMetadata, SectionExecutionResult, FailoverChainOptions };

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
          meta: buildChainMeta({
            provider: 'jarvis',
            attempts: 0,
            repaired: false,
            startTime,
            now: this.now,
            cached: true,
            critic: 'skipped',
          }),
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
    const reasoningMode = SECTION_REASONING_POLICY[params.section];

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
      const candidateResult = await runCandidateAttempt<T>({
        candidate,
        promptData,
        schema: params.schema,
        validationContext: params.validationContext,
        requestId: reqId,
        deadline,
        reasoning: reasoningMode,
        now: this.now,
        sleep: this.sleep,
      });

      attempts += candidateResult.attempts;

      if (candidateResult.success && candidateResult.data !== undefined) {
        let finalData = candidateResult.data;
        let criticStatus: CriticStatus = 'skipped';
        let criticVerdict: CriticVerdict | undefined;

        // Run Critic if applicable and time permits
        if (
          params.profile &&
          (params.section === 'ideas' || params.section === 'menu') &&
          deadline - this.now() > 2000
        ) {
          const criticEval = await this.critic.evaluateSections(
            params.profile,
            { [params.section]: finalData },
            reqId
          );
          criticStatus = criticEval.status;
          criticVerdict = criticEval.verdict;

          if (
            criticStatus === 'ran' &&
            criticVerdict &&
            !criticVerdict.approved &&
            criticVerdict.issues.length > 0
          ) {
            const issueText = criticVerdict.issues.map((i) => i.problem).join('; ');
            const criticRepairUser = `${promptData.user}\n\nCRITIC QUALITY FEEDBACK:\n${issueText}\nPlease adjust the items to resolve these cultural/dietary issues.`;

            if (deadline - this.now() > 1500) {
              const retryResult = await runCandidateAttempt<T>({
                candidate,
                promptData: { system: promptData.system, user: criticRepairUser },
                schema: params.schema,
                validationContext: params.validationContext,
                requestId: reqId,
                deadline,
                reasoning: reasoningMode,
                now: this.now,
                sleep: this.sleep,
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
          meta: buildChainMeta({
            provider: candidate.name,
            attempts,
            repaired: wasRepaired || candidateResult.repaired,
            startTime,
            now: this.now,
            cached: false,
            critic: criticStatus,
            criticVerdict,
            skippedProviders,
          }),
        };
      }

      // Candidate failed; record reason and continue to next candidate
      fallbackReason = candidateResult.error || `${candidate.name} failed to produce valid output`;
    }

    // All LLM providers failed or unconfigured -> Deterministic Template Fallback
    const fallbackData = params.fallbackGetter();

    return {
      data: fallbackData,
      meta: buildChainMeta({
        provider: 'template',
        attempts,
        repaired: false,
        fallbackReason: fallbackReason || 'All providers exhausted or unconfigured',
        startTime,
        now: this.now,
        cached: false,
        critic: 'skipped',
        skippedProviders,
      }),
    };
  }
}
