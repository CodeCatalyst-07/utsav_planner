import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { LLMProvider, GenerateJsonRequest, GenerateJsonResponse, ProviderError } from './provider';
import { getEnv } from '@/server/env';

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  defaultTimeoutMs?: number;
  thinkingBudget?: number;
  client?: GoogleGenAI;
}

export function parseGemini429Details(err: unknown): {
  retryAfterSeconds?: number;
  isDailyQuota: boolean;
  quotaMetric?: string;
} {
  let retryAfterSeconds: number | undefined;
  let isDailyQuota = false;
  let quotaMetric: string | undefined;

  const errorObj = err as any;
  const msg = (errorObj?.message || '').toString();

  if (/per\s*day|daily|perDay|day_limit|freetierperday/i.test(msg)) {
    isDailyQuota = true;
  }

  const metricMatch = msg.match(/(?:quota[-_ ]?metric|metric)['":\s]+([a-zA-Z0-9_./-]+)/i);
  if (metricMatch) {
    quotaMetric = metricMatch[1];
    if (quotaMetric && /day/i.test(quotaMetric)) {
      isDailyQuota = true;
    }
  }

  const details = errorObj?.errorDetails || errorObj?.details || [];
  if (Array.isArray(details)) {
    for (const d of details) {
      if (d?.['@type']?.includes('RetryInfo') && d.retryDelay) {
        const secMatch = String(d.retryDelay).match(/^(\d+)(?:\.\d+)?s?$/);
        if (secMatch && secMatch[1]) retryAfterSeconds = parseInt(secMatch[1], 10);
      }
      if (d?.['@type']?.includes('QuotaFailure')) {
        const desc = JSON.stringify(d.violations || '');
        if (/day/i.test(desc)) isDailyQuota = true;
      }
    }
  }

  if (!retryAfterSeconds) {
    const delayMatch = msg.match(
      /(?:retryDelay|retry-after|retry after|retry in)\D*(\d+)\s*(s|sec|seconds|m|min)?/i
    );
    if (delayMatch) {
      const val = parseInt(delayMatch[1], 10);
      const unit = delayMatch[2]?.toLowerCase();
      if (unit && unit.startsWith('m')) {
        retryAfterSeconds = val * 60;
      } else {
        retryAfterSeconds = val;
      }
    }
  }

  if (!retryAfterSeconds && errorObj?.response?.headers) {
    const headerVal =
      typeof errorObj.response.headers.get === 'function'
        ? errorObj.response.headers.get('retry-after')
        : errorObj.response.headers['retry-after'];
    if (headerVal) {
      const parsed = parseInt(headerVal, 10);
      if (!isNaN(parsed)) retryAfterSeconds = parsed;
    }
  }

  if (retryAfterSeconds && retryAfterSeconds >= 3600) {
    isDailyQuota = true;
  }

  return { retryAfterSeconds, isDailyQuota, quotaMetric };
}

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini' as const;

  private readonly apiKey?: string;
  private readonly model: string;
  private readonly defaultTimeoutMs: number;
  private readonly thinkingBudget: number;
  private readonly client?: GoogleGenAI;

  constructor(options?: GeminiProviderOptions) {
    if (options?.client) {
      this.client = options.client;
      this.model =
        options.model ?? (typeof process !== 'undefined' ? process.env.GEMINI_MODEL : '') ?? '';
      if (!this.model) {
        this.model = 'gemini-test-model';
      }
      this.defaultTimeoutMs = options.defaultTimeoutMs ?? 20_000;
      this.thinkingBudget = options.thinkingBudget ?? 0;
      return;
    }

    try {
      const env = getEnv();
      this.apiKey = options?.apiKey ?? env.GEMINI_API_KEY;
      this.model = options?.model ?? env.GEMINI_MODEL ?? '';
      this.defaultTimeoutMs = options?.defaultTimeoutMs ?? env.LLM_TIMEOUT_MS ?? 20_000;
      this.thinkingBudget = options?.thinkingBudget ?? env.GEMINI_THINKING_BUDGET ?? 0;
    } catch {
      this.apiKey = options?.apiKey;
      this.model = options?.model ?? '';
      this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 20_000;
      this.thinkingBudget = options?.thinkingBudget ?? 0;
    }

    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client || (this.apiKey && this.model));
  }

  async generateJson(req: GenerateJsonRequest): Promise<GenerateJsonResponse> {
    if (!this.client || !this.model) {
      throw new ProviderError({
        kind: 'auth',
        retryable: false,
        message: 'Gemini provider is not configured (missing GEMINI_API_KEY or GEMINI_MODEL)',
      });
    }

    const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (req.signal) {
      req.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: req.user,
        config: {
          systemInstruction: req.system,
          responseMimeType: 'application/json',
          temperature: req.temperature ?? 0.3,
          maxOutputTokens: req.maxTokens,
          thinkingConfig: { thinkingBudget: this.thinkingBudget },
          abortSignal: controller.signal,
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new ProviderError({
          kind: 'bad_output',
          retryable: false,
          message: 'Gemini returned empty candidates array',
        });
      }

      const finishReason = candidate?.finishReason;

      if (finishReason === 'SAFETY') {
        throw new ProviderError({
          kind: 'bad_output',
          retryable: false,
          message: 'Gemini response blocked by safety filters (finishReason: SAFETY)',
        });
      }

      if (finishReason === 'MAX_TOKENS') {
        throw new ProviderError({
          kind: 'truncated',
          retryable: false,
          message: 'Gemini output was truncated by token limit (finishReason: MAX_TOKENS)',
        });
      }

      const text = response.text?.trim() || '';

      if (!text) {
        throw new ProviderError({
          kind: 'bad_output',
          retryable: false,
          message: 'Gemini returned an empty or whitespace-only response',
        });
      }

      return {
        text,
        finishReason,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
        },
      };
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        throw err;
      }

      const error = err as {
        status?: number;
        code?: number | string;
        name?: string;
        message?: string;
      };

      if (error.name === 'AbortError' || controller.signal.aborted) {
        throw new ProviderError({
          kind: 'timeout',
          retryable: true,
          message: `Gemini request timed out after ${timeoutMs}ms`,
          cause: err,
        });
      }

      const messageLower = (error.message || '').toLowerCase();

      if (
        error.status === 401 ||
        error.status === 403 ||
        messageLower.includes('api_key_invalid') ||
        messageLower.includes('permission denied')
      ) {
        throw new ProviderError({
          kind: 'auth',
          retryable: false,
          message: 'Gemini authentication failed (invalid API key)',
          cause: err,
        });
      }

      if (
        error.status === 429 ||
        error.code === 429 ||
        messageLower.includes('resource_exhausted') ||
        messageLower.includes('quota')
      ) {
        const details = parseGemini429Details(err);
        throw new ProviderError({
          kind: 'rate_limit',
          retryable: true,
          message: `Gemini quota or rate limit exceeded${details.quotaMetric ? ` (${details.quotaMetric})` : ''}`,
          retryAfterSeconds: details.retryAfterSeconds,
          isDailyQuota: details.isDailyQuota,
          quotaMetric: details.quotaMetric,
          cause: err,
        });
      }

      if (
        (error.status && error.status >= 500) ||
        messageLower.includes('internal') ||
        messageLower.includes('unavailable')
      ) {
        throw new ProviderError({
          kind: 'server',
          retryable: true,
          message: `Gemini server error: ${error.message || 'Service unavailable'}`,
          cause: err,
        });
      }

      throw new ProviderError({
        kind: 'server',
        retryable: true,
        message: error.message || 'Unknown Gemini error occurred',
        cause: err,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export { GeminiProvider as GeminiLLMProvider };
