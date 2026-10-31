import { describe, it, expect } from 'vitest';
import { JarvisProvider } from '@/server/ai/jarvis';
import { GeminiProvider, parseGemini429Details, parseGoDuration } from '@/server/ai/gemini';
import { IdeasSectionSchema } from '@/server/ai/sections';
import { extractJsonObject } from '@/server/ai/jsonExtract';
import { ProviderError } from '@/server/ai/provider';
import { FailoverChain } from '@/server/ai/chain';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

// Recorded-style contract fixtures
const FIXTURES = {
  validJarvisResponse: {
    id: 'chatcmpl-test-1',
    choices: [
      {
        message: {
          role: 'assistant',
          content:
            '```json\n{"themes": [{"title": "Royal Marigold Heritage", "description": "Authentic Marathi cultural celebration with brass diyas and shehnai."}, {"title": "Lawn Sunset Symphony", "description": "Pastel evening with fairy lights and open-air classical acoustics."}, {"title": "Festive Street Mela", "description": "Lively puppet shows and interactive regional food counters."}]}\n```',
        },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 85, total_tokens: 205 },
  },

  contentNullWithReasoningContent: {
    id: 'chatcmpl-test-reasoning-only',
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          reasoning_content:
            '{"themes": [{"title": "Reasoning Mandap", "description": "Derived from deep thinking."}, {"title": "Reasoning Lawn", "description": "Fresh aesthetic flowers."}, {"title": "Reasoning Heritage", "description": "Cultural authenticity."}]}',
        },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 150, total_tokens: 270 },
  },

  whitespaceOnlyJarvisResponse: {
    id: 'chatcmpl-test-empty',
    choices: [
      {
        message: { role: 'assistant', content: '   \n  \t  ' },
        finish_reason: 'length',
      },
    ],
  },

  finishReasonLengthJarvisResponse: {
    id: 'chatcmpl-test-len',
    choices: [
      {
        message: { role: 'assistant', content: '{"themes": [{"title": "Truncated...' },
        finish_reason: 'length',
      },
    ],
  },

  thinkingModelJarvisResponse: {
    id: 'chatcmpl-test-think',
    choices: [
      {
        message: {
          role: 'assistant',
          content:
            '<think>\nAnalyzing the Pune wedding requirements for 200 guests...\n</think>\n{"themes": [{"title": "Theme 1", "description": "Desc 1"}, {"title": "Theme 2", "description": "Desc 2"}, {"title": "Theme 3", "description": "Desc 3"}]}',
        },
        finish_reason: 'stop',
      },
    ],
  },

  validGeminiResponse: {
    text: '{"themes": [{"title": "Gemini Tradition", "description": "Cultural excellence in Pune."}, {"title": "Eco Green Mandap", "description": "Biodegradable marigold floristry."}, {"title": "Royal Darbar", "description": "Palace elegance and royal feast."}]}',
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            {
              text: '{"themes": [{"title": "Gemini Tradition", "description": "Cultural excellence in Pune."}, {"title": "Eco Green Mandap", "description": "Biodegradable marigold floristry."}, {"title": "Royal Darbar", "description": "Palace elegance and royal feast."}]}',
            },
          ],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 90, totalTokenCount: 240 },
  },

  geminiMaxTokensResponse: {
    candidates: [
      {
        finishReason: 'MAX_TOKENS',
        content: {
          parts: [{ text: '{"themes": [{"title": "Incomplete' }],
        },
      },
    ],
  },

  geminiSafetyBlockedResponse: {
    candidates: [
      {
        finishReason: 'SAFETY',
        content: {
          parts: [],
        },
      },
    ],
  },

  geminiEmptyCandidatesResponse: {
    candidates: [],
  },
};

describe('Provider Contract Fixtures (tests/unit/server/contracts.test.ts)', () => {
  describe('Jarvis Contract Suite', () => {
    it('successfully processes and validates standard valid completion', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => FIXTURES.validJarvisResponse,
          },
        },
      };

      const jarvis = new JarvisProvider({ client: mockClient as any });
      const res = await jarvis.generateJson({
        system: 'sys',
        user: 'usr',
        schemaName: 'ideas',
        maxTokens: 500,
      });

      const parsed = extractJsonObject(res.text);
      const validated = IdeasSectionSchema.safeParse(parsed);
      expect(validated.success).toBe(true);
      expect(validated.data?.themes).toHaveLength(3);
      expect(res.usage?.totalTokens).toBe(205);
    });

    it('handles content null + reasoning_content present by extracting from reasoning', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => FIXTURES.contentNullWithReasoningContent,
          },
        },
      };

      const jarvis = new JarvisProvider({ client: mockClient as any });
      const res = await jarvis.generateJson({
        system: 'sys',
        user: 'usr',
        schemaName: 'ideas',
        maxTokens: 500,
      });

      const parsed = extractJsonObject(res.text);
      const validated = IdeasSectionSchema.safeParse(parsed);
      expect(validated.success).toBe(true);
      expect(validated.data?.themes).toHaveLength(3);
    });

    it('strips <think> blocks and retains valid JSON payload', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => FIXTURES.thinkingModelJarvisResponse,
          },
        },
      };

      const jarvis = new JarvisProvider({ client: mockClient as any });
      const res = await jarvis.generateJson({
        system: 'sys',
        user: 'usr',
        schemaName: 'ideas',
        maxTokens: 500,
      });

      expect(res.text).not.toContain('<think>');
      const parsed = extractJsonObject(res.text);
      expect(IdeasSectionSchema.safeParse(parsed).success).toBe(true);
    });

    it('rejects finish_reason length as truncated error', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => FIXTURES.finishReasonLengthJarvisResponse,
          },
        },
      };

      const jarvis = new JarvisProvider({ client: mockClient as any });
      try {
        await jarvis.generateJson({
          system: 'sys',
          user: 'usr',
          schemaName: 'ideas',
          maxTokens: 500,
        });
        expect.unreachable('Should have thrown ProviderError');
      } catch (err) {
        expect((err as ProviderError).kind).toBe('truncated');
      }
    });

    it('rejects whitespace-only completion as bad_output/truncated error', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => FIXTURES.whitespaceOnlyJarvisResponse,
          },
        },
      };

      const jarvis = new JarvisProvider({ client: mockClient as any });
      try {
        await jarvis.generateJson({
          system: 'sys',
          user: 'usr',
          schemaName: 'ideas',
          maxTokens: 500,
        });
        expect.unreachable('Should have thrown ProviderError');
      } catch (err) {
        expect((err as ProviderError).kind).toBe('truncated');
      }
    });

    it('maps HTTP 429 rate limits to typed retryable ProviderError with retryAfter', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => {
              const err = new Error('Rate limit exceeded') as any;
              err.status = 429;
              err.headers = { 'retry-after': '3' };
              throw err;
            },
          },
        },
      };

      const jarvis = new JarvisProvider({ client: mockClient as any });
      try {
        await jarvis.generateJson({
          system: 'sys',
          user: 'usr',
          schemaName: 'ideas',
          maxTokens: 500,
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        const pErr = err as ProviderError;
        expect(pErr.kind).toBe('rate_limit');
        expect(pErr.retryable).toBe(true);
        expect(pErr.retryAfterSeconds).toBe(3);
      }
    });

    it('maps HTTP 500 server errors to typed retryable ProviderError', async () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => {
              const err = new Error('Internal Server Error') as any;
              err.status = 500;
              throw err;
            },
          },
        },
      };

      const jarvis = new JarvisProvider({ client: mockClient as any });
      try {
        await jarvis.generateJson({
          system: 'sys',
          user: 'usr',
          schemaName: 'ideas',
          maxTokens: 500,
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        const pErr = err as ProviderError;
        expect(pErr.kind).toBe('server');
        expect(pErr.retryable).toBe(true);
      }
    });
  });

  describe('Gemini Contract Suite', () => {
    it('successfully processes and validates standard valid completion', async () => {
      const mockGenai = {
        models: {
          generateContent: async () => FIXTURES.validGeminiResponse,
        },
      };

      const gemini = new GeminiProvider({ client: mockGenai as any });
      const res = await gemini.generateJson({
        system: 'sys',
        user: 'usr',
        schemaName: 'ideas',
        maxTokens: 500,
      });

      const parsed = extractJsonObject(res.text);
      const validated = IdeasSectionSchema.safeParse(parsed);
      expect(validated.success).toBe(true);
      expect(validated.data?.themes).toHaveLength(3);
      expect(res.usage?.totalTokens).toBe(240);
    });

    it('maps 429 with retryDelay and daily quota metric correctly', async () => {
      const mockGenai = {
        models: {
          generateContent: async () => {
            const err = new Error(
              'Resource has been exhausted (e.g. check quota). retryDelay: 57186s, metric: generativelanguage.googleapis.com/generate_content_free_tier_requests'
            ) as any;
            err.status = 429;
            throw err;
          },
        },
      };

      const gemini = new GeminiProvider({ client: mockGenai as any });
      try {
        await gemini.generateJson({
          system: 'sys',
          user: 'usr',
          schemaName: 'ideas',
          maxTokens: 500,
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        const pErr = err as ProviderError;
        expect(pErr.kind).toBe('rate_limit');
        expect(pErr.retryAfterSeconds).toBe(1800); // Daily quota capped at 30 min
        expect(pErr.isDailyQuota).toBe(true);
        expect(pErr.quotaMetric).toBe(
          'generativelanguage.googleapis.com/generate_content_free_tier_requests'
        );
      }
    });

    it('handles MAX_TOKENS truncation finishReason', async () => {
      const mockGenai = {
        models: {
          generateContent: async () => FIXTURES.geminiMaxTokensResponse,
        },
      };

      const gemini = new GeminiProvider({ client: mockGenai as any });
      try {
        await gemini.generateJson({
          system: 'sys',
          user: 'usr',
          schemaName: 'ideas',
          maxTokens: 500,
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        const pErr = err as ProviderError;
        expect(pErr.kind).toBe('truncated');
        expect(pErr.message).toContain('MAX_TOKENS');
      }
    });

    it('handles SAFETY filter block finishReason', async () => {
      const mockGenai = {
        models: {
          generateContent: async () => FIXTURES.geminiSafetyBlockedResponse,
        },
      };

      const gemini = new GeminiProvider({ client: mockGenai as any });
      try {
        await gemini.generateJson({
          system: 'sys',
          user: 'usr',
          schemaName: 'ideas',
          maxTokens: 500,
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        const pErr = err as ProviderError;
        expect(pErr.kind).toBe('bad_output');
        expect(pErr.message).toContain('SAFETY');
      }
    });

    it('handles empty candidates array gracefully', async () => {
      const mockGenai = {
        models: {
          generateContent: async () => FIXTURES.geminiEmptyCandidatesResponse,
        },
      };

      const gemini = new GeminiProvider({ client: mockGenai as any });
      try {
        await gemini.generateJson({
          system: 'sys',
          user: 'usr',
          schemaName: 'ideas',
          maxTokens: 500,
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        const pErr = err as ProviderError;
        expect(pErr.kind).toBe('bad_output');
        expect(pErr.message).toContain('empty candidates');
      }
    });
  });

  describe('Clean Template Fallback Execution across Failure Fixtures', () => {
    it('falls back cleanly to deterministic template when Jarvis returns finish_reason: length', async () => {
      const mockJarvis = {
        name: 'jarvis',
        isConfigured: () => true,
        generateJson: async () => {
          throw new ProviderError({ kind: 'truncated', retryable: false, message: 'Truncated' });
        },
      };
      const mockGemini = {
        name: 'gemini',
        isConfigured: () => true,
        generateJson: async () => {
          throw new ProviderError({ kind: 'bad_output', retryable: false, message: 'Bad output' });
        },
      };

      const chain = new FailoverChain({
        jarvis: mockJarvis as any,
        gemini: mockGemini as any,
        critic: null as any,
      });

      const res = await chain.executeSection({
        section: 'ideas',
        schema: IdeasSectionSchema,
        profile: weddingPuneFixture,
        promptBuilder: () => ({ system: 'sys', user: 'usr' }),
        fallbackGetter: () => ({
          themes: [{ title: 'Fallback Theme', description: 'Deterministic fallback description' }],
        }),
      });

      expect(res.meta.provider).toBe('template');
      expect(res.data).toBeDefined();
      expect(res.data.themes.length).toBeGreaterThanOrEqual(1);
      expect(res.meta.fallbackReason).toBeDefined();
    });

    it('falls back cleanly to deterministic template when Gemini returns 429 quota exhaustion', async () => {
      const mockJarvis = {
        name: 'jarvis',
        isConfigured: () => true,
        generateJson: async () => {
          throw new ProviderError({ kind: 'server', retryable: true, message: '500' });
        },
      };
      const mockGemini = {
        name: 'gemini',
        isConfigured: () => true,
        generateJson: async () => {
          throw new ProviderError({
            kind: 'rate_limit',
            retryable: true,
            retryAfterSeconds: 60,
            message: 'Quota exceeded',
          });
        },
      };

      const chain = new FailoverChain({
        jarvis: mockJarvis as any,
        gemini: mockGemini as any,
        critic: null as any,
      });

      const res = await chain.executeSection({
        section: 'ideas',
        schema: IdeasSectionSchema,
        profile: weddingPuneFixture,
        promptBuilder: () => ({ system: 'sys', user: 'usr' }),
        fallbackGetter: () => ({
          themes: [{ title: 'Fallback Theme', description: 'Deterministic fallback description' }],
        }),
      });

      expect(res.meta.provider).toBe('template');
      expect(res.data).toBeDefined();
      expect(res.meta.fallbackReason).toBeDefined();
    });
  });

  describe('Gemini 429 Retry Delay & Go Duration Parsing', () => {
    it('correctly parses Go-style durations', () => {
      expect(parseGoDuration('52030s')).toBe(52030);
      expect(parseGoDuration('14h27m10.105s')).toBe(52030);
      expect(parseGoDuration('250ms')).toBe(1);
      expect(parseGoDuration('5m30s')).toBe(330);
      expect(parseGoDuration('45s')).toBe(45);
      expect(parseGoDuration('1h')).toBe(3600);
      expect(parseGoDuration('invalid')).toBeNull();
      expect(parseGoDuration('')).toBeNull();
    });

    it('parses exact Gemini 429 probe payload with RetryInfo and daily quota cap', () => {
      const probePayload = {
        message:
          'Resource has been exhausted (e.g. check quota). Please retry in 14h27m10.105477483s',
        status: 429,
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              {
                quotaMetric:
                  'generativelanguage.googleapis.com/generate_content_free_tier_requests_per_day',
                description: 'Daily request quota exceeded',
              },
            ],
          },
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '52030s',
          },
        ],
      };

      const parsed = parseGemini429Details(probePayload);
      expect(parsed.rawParsedSeconds).toBe(52030);
      expect(parsed.isDailyQuota).toBe(true);
      expect(parsed.quotaMetric).toBe(
        'generativelanguage.googleapis.com/generate_content_free_tier_requests_per_day'
      );
      // Daily quota capped at 30 minutes (1800s)
      expect(parsed.retryAfterSeconds).toBe(1800);
    });

    it('parses text-only retry delay and caps rate-limit errors at 5 minutes', () => {
      const rateLimitError = new Error(
        'Resource has been exhausted: quota exceeded for quota metric "generate_content_requests_per_minute". Please retry in 5m30s.'
      );
      const parsed = parseGemini429Details(rateLimitError);
      expect(parsed.rawParsedSeconds).toBe(330);
      expect(parsed.isDailyQuota).toBe(false);
      // Rate limit capped at 5 minutes (300s)
      expect(parsed.retryAfterSeconds).toBe(300);
    });

    it('parses sub-second millisecond retry delay accurately', () => {
      const msError = new Error('Rate limit reached. Please retry in 250ms');
      const parsed = parseGemini429Details(msError);
      expect(parsed.rawParsedSeconds).toBe(1);
      expect(parsed.retryAfterSeconds).toBe(1);
      expect(parsed.isDailyQuota).toBe(false);
    });
  });
});
