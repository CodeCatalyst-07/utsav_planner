import 'server-only';
import OpenAI from 'openai';
import { LLMProvider, GenerateJsonRequest, GenerateJsonResponse, ProviderError } from './provider';
import { getEnv } from '@/server/env';

export interface JarvisProviderOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  jsonMode?: 'prompt_only' | 'response_format';
  extraBody?: Record<string, unknown>;
  defaultTimeoutMs?: number;
  client?: OpenAI;
}

export interface JarvisMessageShape {
  content?: string | null;
  reasoning_content?: string | null;
}

/**
 * Builds OpenAI-compatible request payload for Jarvis Labs inference endpoints.
 * Precedence:
 * 1. Base parameters (model, messages, temp, max_tokens, jsonMode)
 * 2. Per-section reasoning policy default (reasoning: 'off' -> enable_thinking: false)
 * 3. Request-level extraBody
 * 4. Global override (JARVIS_EXTRA_BODY_JSON / extraBody option)
 */
export function buildJarvisRequestBody(
  model: string,
  req: GenerateJsonRequest,
  options?: {
    jsonMode?: 'prompt_only' | 'response_format';
    extraBody?: Record<string, unknown>;
  }
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  const jsonMode = options?.jsonMode ?? 'prompt_only';
  const globalExtra = options?.extraBody ?? {};

  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens,
    ...(jsonMode === 'response_format' ? { response_format: { type: 'json_object' } } : {}),
  };

  // 1. Per-section reasoning policy
  if (req.reasoning === 'off') {
    payload.chat_template_kwargs = { enable_thinking: false };
  }

  // 2. Request-level extraBody
  if (req.extraBody) {
    Object.assign(payload, req.extraBody);
  }

  // 3. Global override remains supreme
  if (globalExtra && Object.keys(globalExtra).length > 0) {
    Object.assign(payload, globalExtra);
  }

  return payload as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
}

export class JarvisProvider implements LLMProvider {
  readonly name = 'jarvis' as const;

  private readonly apiKey?: string;
  private readonly baseURL: string;
  private readonly model: string;
  private readonly jsonMode: 'prompt_only' | 'response_format';
  private readonly extraBody: Record<string, unknown>;
  private readonly defaultTimeoutMs: number;
  private readonly client?: OpenAI;

  constructor(options?: JarvisProviderOptions) {
    if (options?.client) {
      this.client = options.client;
      this.baseURL = options.baseURL ?? 'https://models.jarvislabs.net/v1';
      this.model = options.model ?? 'gemma-4-31b-it';
      this.jsonMode = options.jsonMode ?? 'prompt_only';
      this.extraBody = options.extraBody ?? {};
      this.defaultTimeoutMs = options.defaultTimeoutMs ?? 20_000;
      return;
    }

    try {
      const env = getEnv();
      this.apiKey = options?.apiKey ?? env.JARVISLABS_API_KEY;
      this.baseURL = options?.baseURL ?? env.JARVIS_BASE_URL;
      this.model = options?.model ?? env.JARVIS_MODEL;
      this.jsonMode = options?.jsonMode ?? env.JARVIS_JSON_MODE;
      this.extraBody = options?.extraBody ?? env.JARVIS_EXTRA_BODY_JSON;
      this.defaultTimeoutMs = options?.defaultTimeoutMs ?? env.LLM_TIMEOUT_MS ?? 20_000;
    } catch {
      this.apiKey = options?.apiKey;
      this.baseURL = options?.baseURL ?? 'https://models.jarvislabs.net/v1';
      this.model = options?.model ?? 'gemma-4-31b-it';
      this.jsonMode = options?.jsonMode ?? 'prompt_only';
      this.extraBody = options?.extraBody ?? {};
      this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 20_000;
    }

    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client || this.apiKey);
  }

  async generateJson(req: GenerateJsonRequest): Promise<GenerateJsonResponse> {
    if (!this.client) {
      throw new ProviderError({
        kind: 'auth',
        retryable: false,
        message: 'Jarvis provider is not configured (missing JARVISLABS_API_KEY)',
      });
    }

    const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Chain external signal if provided
    if (req.signal) {
      req.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const requestPayload = buildJarvisRequestBody(this.model, req, {
        jsonMode: this.jsonMode,
        extraBody: this.extraBody,
      });

      const completion = await this.client.chat.completions.create(requestPayload, {
        signal: controller.signal,
      });

      const choice = completion.choices?.[0];
      const finishReason = choice?.finish_reason || undefined;
      const msg = choice?.message as JarvisMessageShape | undefined;
      const rawContent =
        msg?.content && typeof msg.content === 'string' && msg.content.trim()
          ? msg.content
          : typeof msg?.reasoning_content === 'string'
            ? msg.reasoning_content
            : '';

      // Strip <think>...</think> blocks from reasoning models
      const cleanedText = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      if (finishReason === 'length') {
        throw new ProviderError({
          kind: 'truncated',
          retryable: false,
          message: 'Jarvis output was truncated by token limit (finish_reason: length)',
        });
      }

      if (!cleanedText) {
        throw new ProviderError({
          kind: 'bad_output',
          retryable: false,
          message: 'Jarvis returned an empty or whitespace-only response',
        });
      }

      const reasoningTokens = (
        completion.usage as
          { completion_tokens_details?: { reasoning_tokens?: number } } | undefined
      )?.completion_tokens_details?.reasoning_tokens;

      return {
        text: cleanedText,
        finishReason,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
          reasoningTokens,
        },
      };
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        throw err;
      }

      const error = err as {
        status?: number;
        code?: string;
        name?: string;
        message?: string;
        headers?: Record<string, string>;
      };

      if (error.name === 'AbortError' || controller.signal.aborted) {
        throw new ProviderError({
          kind: 'timeout',
          retryable: true,
          message: `Jarvis request timed out after ${timeoutMs}ms`,
          cause: err,
        });
      }

      if (error.status === 401 || error.status === 403) {
        throw new ProviderError({
          kind: 'auth',
          retryable: false,
          message: 'Jarvis authentication failed (invalid or expired API key)',
          cause: err,
        });
      }

      if (error.status === 429) {
        const retryAfterHeader = error.headers?.['retry-after'];
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        throw new ProviderError({
          kind: 'rate_limit',
          retryable: true,
          message: 'Jarvis rate limit exceeded',
          retryAfterSeconds: isNaN(retryAfterSeconds!) ? undefined : retryAfterSeconds,
          cause: err,
        });
      }

      if (error.status && error.status >= 500) {
        throw new ProviderError({
          kind: 'server',
          retryable: true,
          message: `Jarvis server error: HTTP ${error.status}`,
          cause: err,
        });
      }

      throw new ProviderError({
        kind: 'server',
        retryable: true,
        message: error.message || 'Unknown Jarvis error occurred',
        cause: err,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export { JarvisProvider as JarvisLLMProvider };
