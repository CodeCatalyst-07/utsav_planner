import 'server-only';

export type ProviderName = 'jarvis' | 'gemini' | 'template';

export type ProviderErrorKind =
  'rate_limit' | 'server' | 'timeout' | 'auth' | 'bad_output' | 'truncated';

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly isDailyQuota?: boolean;
  readonly quotaMetric?: string;
  override readonly cause?: unknown;

  constructor(options: {
    kind: ProviderErrorKind;
    retryable: boolean;
    message: string;
    retryAfterSeconds?: number;
    isDailyQuota?: boolean;
    quotaMetric?: string;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'ProviderError';
    this.kind = options.kind;
    this.retryable = options.retryable;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.isDailyQuota = options.isDailyQuota;
    this.quotaMetric = options.quotaMetric;
    this.cause = options.cause;
  }
}

export interface GenerateJsonRequest {
  system: string;
  user: string;
  schemaName: string;
  maxTokens: number;
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface GenerateJsonResponse {
  text: string;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
  };
}

export interface LLMProvider {
  readonly name: 'jarvis' | 'gemini';
  generateJson(req: GenerateJsonRequest): Promise<GenerateJsonResponse>;
}
