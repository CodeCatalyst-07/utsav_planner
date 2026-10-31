import { describe, it, expect, vi } from 'vitest';
import { JarvisLLMProvider } from '@/server/ai/jarvis';
import { GeminiLLMProvider } from '@/server/ai/gemini';
import { ProviderError } from '@/server/ai/provider';

describe('LLM Providers Unit Tests (src/server/ai/jarvis.ts & gemini.ts)', () => {
  describe('JarvisLLMProvider', () => {
    it('throws auth ProviderError if apiKey/client is missing', async () => {
      const provider = new JarvisLLMProvider({ apiKey: '' });
      expect(provider.isConfigured()).toBe(false);

      await expect(
        provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        })
      ).rejects.toMatchObject({
        kind: 'auth',
        retryable: false,
      });
    });

    it('maps 401/403 to auth ProviderError', async () => {
      const fakeClient = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue({
              status: 401,
              message: 'Unauthorized',
            }),
          },
        },
      } as any;

      const provider = new JarvisLLMProvider({ client: fakeClient });
      await expect(
        provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        })
      ).rejects.toMatchObject({
        kind: 'auth',
        retryable: false,
      });
    });

    it('maps 429 with retry-after header to rate_limit ProviderError', async () => {
      const fakeClient = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue({
              status: 429,
              message: 'Too Many Requests',
              headers: { 'retry-after': '15' },
            }),
          },
        },
      } as any;

      const provider = new JarvisLLMProvider({ client: fakeClient });
      let caught: any;
      try {
        await provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ProviderError);
      expect(caught.kind).toBe('rate_limit');
      expect(caught.retryAfterSeconds).toBe(15);
      expect(caught.retryable).toBe(true);
    });

    it('maps HTTP >= 500 to server ProviderError', async () => {
      const fakeClient = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue({
              status: 503,
              message: 'Service Unavailable',
            }),
          },
        },
      } as any;

      const provider = new JarvisLLMProvider({ client: fakeClient });
      await expect(
        provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        })
      ).rejects.toMatchObject({
        kind: 'server',
        retryable: true,
      });
    });

    it('maps AbortError / timeout to timeout ProviderError', async () => {
      const fakeClient = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue({
              name: 'AbortError',
              message: 'Request aborted',
            }),
          },
        },
      } as any;

      const provider = new JarvisLLMProvider({ client: fakeClient });
      await expect(
        provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        })
      ).rejects.toMatchObject({
        kind: 'timeout',
        retryable: true,
      });
    });

    it('handles response_format json mode and extraBody injection', async () => {
      let capturedBody: any;
      const fakeClient = {
        chat: {
          completions: {
            create: vi.fn().mockImplementation(async (body: any) => {
              capturedBody = body;
              return {
                choices: [{ message: { content: '{"themes":[]}' } }],
                usage: { total_tokens: 42 },
              };
            }),
          },
        },
      } as any;

      const provider = new JarvisLLMProvider({
        client: fakeClient,
        jsonMode: 'response_format',
        extraBody: { custom_param: 'test_val' },
      });

      const res = await provider.generateJson({
        schemaName: 'ideas',
        system: 'sys',
        user: 'usr',
        maxTokens: 500,
      });

      expect(res.text).toBe('{"themes":[]}');
      expect(capturedBody.response_format).toEqual({ type: 'json_object' });
      expect(capturedBody.custom_param).toBe('test_val');
      expect(res.usage?.totalTokens).toBe(42);
    });

    it('strips <think> tags from model output', async () => {
      const fakeClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: '<think>Let me ponder this for a moment...</think>{"status":"ok"}',
                  },
                },
              ],
            }),
          },
        },
      } as any;

      const provider = new JarvisLLMProvider({ client: fakeClient });
      const res = await provider.generateJson({
        schemaName: 'ideas',
        system: 'sys',
        user: 'usr',
        maxTokens: 500,
      });
      expect(res.text).toBe('{"status":"ok"}');
    });
  });

  describe('GeminiLLMProvider', () => {
    it('throws auth ProviderError if apiKey is missing', async () => {
      const provider = new GeminiLLMProvider({ apiKey: '' });
      expect(provider.isConfigured()).toBe(false);

      await expect(
        provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        })
      ).rejects.toMatchObject({
        kind: 'auth',
        retryable: false,
      });
    });

    it('maps quota / 429 errors to rate_limit ProviderError', async () => {
      const fakeClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue({
            status: 429,
            message: 'RESOURCE_EXHAUSTED: Quota exceeded for model',
          }),
        },
      } as any;

      const provider = new GeminiLLMProvider({ client: fakeClient });
      await expect(
        provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        })
      ).rejects.toMatchObject({
        kind: 'rate_limit',
        retryable: true,
      });
    });

    it('maps 401/403 or invalid api key to auth ProviderError', async () => {
      const fakeClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue({
            status: 403,
            message: 'API_KEY_INVALID: The provided API key is expired',
          }),
        },
      } as any;

      const provider = new GeminiLLMProvider({ client: fakeClient });
      await expect(
        provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        })
      ).rejects.toMatchObject({
        kind: 'auth',
        retryable: false,
      });
    });

    it('maps 500 / internal server errors to server ProviderError', async () => {
      const fakeClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue({
            status: 500,
            message: 'INTERNAL: Service unavailable',
          }),
        },
      } as any;

      const provider = new GeminiLLMProvider({ client: fakeClient });
      await expect(
        provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        })
      ).rejects.toMatchObject({
        kind: 'server',
        retryable: true,
      });
    });

    it('maps AbortError / timeout to timeout ProviderError', async () => {
      const fakeClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue({
            name: 'AbortError',
            message: 'Request timed out',
          }),
        },
      } as any;

      const provider = new GeminiLLMProvider({ client: fakeClient });
      await expect(
        provider.generateJson({
          schemaName: 'ideas',
          system: 'sys',
          user: 'usr',
          maxTokens: 500,
        })
      ).rejects.toMatchObject({
        kind: 'timeout',
        retryable: true,
      });
    });
  });
});
