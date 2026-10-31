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

export function parseGoDuration(str: string): number | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim().toLowerCase();

  // If pure numeric string (in seconds)
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Math.round(parseFloat(trimmed));
  }

  // Handle single unit ms: e.g. "250ms"
  if (/^\d+(?:\.\d+)?ms$/.test(trimmed)) {
    const ms = parseFloat(trimmed);
    return Math.max(1, Math.round(ms / 1000));
  }

  // Parse composite Go duration: e.g. "14h27m10.105s", "52030s", "15m", "300s"
  const regex =
    /(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?/;
  const match = trimmed.match(regex);
  if (!match || match[0] === '') return null;

  const hours = match[1] ? parseFloat(match[1]) : 0;
  const minutes = match[2] ? parseFloat(match[2]) : 0;
  const seconds = match[3] ? parseFloat(match[3]) : 0;
  const ms = match[4] ? parseFloat(match[4]) : 0;

  const totalSeconds = hours * 3600 + minutes * 60 + seconds + ms / 1000;
  return totalSeconds > 0
    ? totalSeconds < 1
      ? Math.ceil(totalSeconds)
      : Math.round(totalSeconds)
    : null;
}

export function parseGemini429Details(err: unknown): {
  retryAfterSeconds?: number;
  isDailyQuota: boolean;
  quotaMetric?: string;
  rawParsedSeconds?: number;
} {
  let retryAfterSeconds: number | undefined;
  let isDailyQuota = false;
  let quotaMetric: string | undefined;

  const errorObj = err as {
    message?: string;
    errorDetails?: Array<Record<string, unknown>>;
    details?: Array<Record<string, unknown>>;
    error?: { details?: Array<Record<string, unknown>> };
    response?: {
      headers?: Headers | Record<string, string | undefined>;
    };
  } | null;
  const msg = (errorObj?.message || '').toString();

  // Check if error message is stringified JSON
  let innerPayload: {
    error?: { details?: Array<Record<string, unknown>> };
    details?: Array<Record<string, unknown>>;
  } | null = null;
  try {
    if (typeof msg === 'string' && msg.trim().startsWith('{')) {
      const parsed = JSON.parse(msg.trim());
      if (typeof parsed === 'object' && parsed !== null) {
        innerPayload = parsed;
      }
    }
  } catch {
    // not JSON
  }

  const combinedText = `${msg} ${JSON.stringify(innerPayload || '')}`;

  if (/per\s*day|daily|perDay|day_limit|freetierperday/i.test(combinedText)) {
    isDailyQuota = true;
  }

  const metricMatch = combinedText.match(/(?:quota[-_ ]?metric|metric)['":\s]+([a-zA-Z0-9_./-]+)/i);
  if (metricMatch) {
    quotaMetric = metricMatch[1];
    if (quotaMetric && /day/i.test(quotaMetric)) {
      isDailyQuota = true;
    }
  }

  const details =
    errorObj?.errorDetails ||
    errorObj?.details ||
    innerPayload?.error?.details ||
    innerPayload?.details ||
    [];

  if (Array.isArray(details)) {
    for (const d of details) {
      const typeStr = String(d?.['@type'] || '');
      if (typeStr.includes('RetryInfo') && d.retryDelay) {
        const parsedSec = parseGoDuration(String(d.retryDelay));
        if (parsedSec !== null) retryAfterSeconds = parsedSec;
      }
      if (typeStr.includes('QuotaFailure')) {
        const desc = JSON.stringify(d.violations || '');
        if (/day/i.test(desc)) isDailyQuota = true;
        if (!quotaMetric && Array.isArray(d.violations) && d.violations[0]?.quotaMetric) {
          quotaMetric = String(d.violations[0].quotaMetric);
        }
      }
    }
  }

  if (retryAfterSeconds === undefined) {
    const delayMatch = combinedText.match(
      /(?:retry in|retry after|retryDelay[:\s=]+)\s*([0-9hms.]+)/i
    );
    if (delayMatch && delayMatch[1]) {
      const parsedSec = parseGoDuration(delayMatch[1]);
      if (parsedSec !== null) retryAfterSeconds = parsedSec;
    }
  }

  if (retryAfterSeconds === undefined && errorObj?.response?.headers) {
    const headers = errorObj.response.headers;
    const headerVal =
      headers instanceof Headers
        ? headers.get('retry-after')
        : typeof (headers as { get?: unknown }).get === 'function'
          ? (headers as unknown as Headers).get('retry-after')
          : (headers as Record<string, string | undefined>)['retry-after'];
    if (headerVal) {
      const parsed = parseInt(headerVal, 10);
      if (!isNaN(parsed)) retryAfterSeconds = parsed;
    }
  }

  if (retryAfterSeconds && retryAfterSeconds >= 3600) {
    isDailyQuota = true;
  }

  const rawParsedSeconds = retryAfterSeconds;

  // Apply caps: 5 min (300s) for per-minute rate limits, 30 min (1800s) for daily quota
  if (retryAfterSeconds !== undefined) {
    const maxCap = isDailyQuota ? 30 * 60 : 5 * 60;
    retryAfterSeconds = Math.min(retryAfterSeconds, maxCap);
  }

  return {
    retryAfterSeconds,
    isDailyQuota,
    quotaMetric,
    rawParsedSeconds,
  };
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
