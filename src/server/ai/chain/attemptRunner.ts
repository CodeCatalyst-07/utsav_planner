import 'server-only';
import { AttemptResult, AttemptRunnerArgs } from './types';
import { ProviderError } from '../provider';
import { extractJsonObject } from '../jsonExtract';
import { validateOutput } from '../validators';
import { buildRepairPrompt } from '../prompts';
import { logger } from '@/server/security/logger';

/**
 * Executes an individual provider candidate attempt, including output extraction,
 * schema validation, non-truncated repair attempt, and rate-limit retries.
 */
export async function runCandidateAttempt<T>(
  args: AttemptRunnerArgs<T>
): Promise<AttemptResult<T>> {
  const {
    candidate,
    promptData,
    schema,
    validationContext,
    requestId,
    deadline,
    reasoning,
    now,
    sleep,
  } = args;

  let attempts = 0;
  const remainingMs = deadline - now();
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
  const t0 = now();
  try {
    const attemptTimeout = Math.min(Math.max(500, remainingMs), 12000);
    const response = await candidate.provider.generateJson({
      system: promptData.system,
      user: promptData.user,
      schemaName: 'section_output',
      maxTokens: 2500,
      temperature: 0.3,
      timeoutMs: attemptTimeout,
      reasoning,
    });
    const attemptLatency = now() - t0;

    // Extract balanced JSON
    let parseError: string | null = null;
    let parsed: unknown = null;
    let isTruncated = response.finishReason === 'length' || response.finishReason === 'MAX_TOKENS';

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
    const repairRemainingMs = deadline - now();
    if (repairRemainingMs > 2500) {
      attempts++;
      const tRepair = now();
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
          reasoning,
        });
        const repairLatency = now() - tRepair;

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
          latencyMs: now() - tRepair,
          message: 'LLM repair attempt error',
          extra: {
            attemptNumber: attempts,
            errorKind: repairErr instanceof ProviderError ? repairErr.kind : 'server',
            outputLength: 0,
          },
        });
      }
    }

    // Both initial and repair failed validation
    candidate.breaker.recordFailure();
    return {
      success: false,
      attempts,
      repaired: false,
      error: parseError || 'Repair output failed validation',
    };
  } catch (err: unknown) {
    const attemptLatency = now() - t0;
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

      // If rate limited with Retry-After <= 2s, honor once with short sleep if deadline permits
      if (
        err.kind === 'rate_limit' &&
        err.retryAfterSeconds &&
        err.retryAfterSeconds <= 2 &&
        deadline - now() > err.retryAfterSeconds * 1000 + 2000
      ) {
        try {
          await sleep(err.retryAfterSeconds * 1000 + 100);
          attempts++;
          const tRetry = now();
          const retryRes = await candidate.provider.generateJson({
            system: promptData.system,
            user: promptData.user,
            schemaName: 'section_output_retry',
            maxTokens: 2500,
            timeoutMs: Math.min(deadline - now(), 8000),
            reasoning,
          });
          const parsed = extractJsonObject(retryRes.text);
          const val = validateOutput(parsed, schema, validationContext);
          if (val.valid && val.data !== undefined) {
            logger.info({
              requestId,
              route: 'chain',
              provider: candidate.name,
              status: 'ok',
              latencyMs: now() - tRetry,
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
