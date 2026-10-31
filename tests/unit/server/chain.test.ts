import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { FailoverChain } from '@/server/ai/chain';
import { ProviderError, LLMProvider } from '@/server/ai/provider';
import { CircuitBreaker } from '@/server/security/circuitBreaker';
import { AICache } from '@/server/ai/cache';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';
import { _resetEnvCacheForTesting } from '@/server/env';

describe('AI Failover Chain (src/server/ai/chain.ts)', () => {
  const testSchema = z.object({
    theme: z.string(),
  });

  const validThemeJson = JSON.stringify({ theme: 'Royal Heritage' });
  const validGeminiJson = JSON.stringify({ theme: 'Gemini Garden' });
  const fallbackGetter = () => ({ theme: 'Fallback Theme' });

  let fakeJarvis: {
    name: 'jarvis';
    isConfigured: () => boolean;
    getModel: () => string;
    generateJson: ReturnType<typeof vi.fn>;
  };
  let fakeGemini: {
    name: 'gemini';
    isConfigured: () => boolean;
    getModel: () => string;
    generateJson: ReturnType<typeof vi.fn>;
  };
  let jarvisBreaker: CircuitBreaker;
  let geminiBreaker: CircuitBreaker;
  let testCache: AICache;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1_000_000;
    jarvisBreaker = new CircuitBreaker({ now: () => currentTime, resetTimeoutMs: 30_000 });
    geminiBreaker = new CircuitBreaker({ now: () => currentTime, resetTimeoutMs: 30_000 });
    testCache = new AICache({ now: () => currentTime, ttlSeconds: 1800 });

    fakeJarvis = {
      name: 'jarvis',
      isConfigured: () => true,
      getModel: () => 'gemma-4-31b-it',
      generateJson: vi.fn(),
    };

    fakeGemini = {
      name: 'gemini',
      isConfigured: () => true,
      getModel: () => 'gemini-2.5-flash',
      generateJson: vi.fn(),
    };
  });

  function createChain(criticMock?: any) {
    return new FailoverChain({
      jarvis: fakeJarvis as any,
      gemini: fakeGemini as any,
      jarvisBreaker,
      geminiBreaker,
      cache: testCache,
      critic: criticMock ?? {
        evaluateSections: vi.fn().mockResolvedValue({ status: 'skipped' }),
        isEnabled: () => false,
      },
      now: () => currentTime,
      sleep: vi.fn().mockResolvedValue(undefined),
    });
  }

  it('successfully returns Jarvis output when primary succeeds on first attempt', async () => {
    fakeJarvis.generateJson.mockResolvedValueOnce({ text: validThemeJson });
    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Royal Heritage' });
    expect(res.meta.provider).toBe('jarvis');
    expect(res.meta.attempts).toBe(1);
    expect(res.meta.repaired).toBe(false);
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(1);
    expect(fakeGemini.generateJson).not.toHaveBeenCalled();
  });

  it('triggers repair loop on invalid initial output and succeeds with repaired: true', async () => {
    // Initial call returns schema-invalid output, repair call returns valid output
    fakeJarvis.generateJson
      .mockResolvedValueOnce({ text: '{"wrongKey": 123}' })
      .mockResolvedValueOnce({ text: validThemeJson });

    const chain = createChain();
    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Royal Heritage' });
    expect(res.meta.provider).toBe('jarvis');
    expect(res.meta.attempts).toBe(2);
    expect(res.meta.repaired).toBe(true);
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(2);
    expect(fakeGemini.generateJson).not.toHaveBeenCalled();
  });

  it('fails over to Gemini when Jarvis outputs invalid JSON twice', async () => {
    // Jarvis fails initial + repair
    fakeJarvis.generateJson
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValueOnce({ text: 'still not json' });

    // Gemini succeeds
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();
    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Gemini Garden' });
    expect(res.meta.provider).toBe('gemini');
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(2);
    expect(fakeGemini.generateJson).toHaveBeenCalledTimes(1);
  });

  it('fails over immediately on rate_limit, server 5xx, or timeout without redundant retries', async () => {
    fakeJarvis.generateJson.mockRejectedValueOnce(
      new ProviderError({
        kind: 'server',
        retryable: true,
        message: 'Jarvis 503 Service Unavailable',
      })
    );
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();
    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Gemini Garden' });
    expect(res.meta.provider).toBe('gemini');
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(1);
    expect(fakeGemini.generateJson).toHaveBeenCalledTimes(1);
  });

  it('falls back to deterministic template when both Jarvis and Gemini fail', async () => {
    fakeJarvis.generateJson.mockRejectedValueOnce(
      new ProviderError({ kind: 'timeout', retryable: true, message: 'Timeout' })
    );
    fakeGemini.generateJson.mockRejectedValueOnce(
      new ProviderError({ kind: 'rate_limit', retryable: true, message: 'Quota exceeded' })
    );

    const chain = createChain();
    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Fallback Theme' });
    expect(res.meta.provider).toBe('template');
    expect(res.meta.fallbackReason).toBeDefined();
  });

  it('silently skips unconfigured providers', async () => {
    fakeJarvis.isConfigured = () => false;
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();
    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Gemini Garden' });
    expect(res.meta.provider).toBe('gemini');
    expect(fakeJarvis.generateJson).not.toHaveBeenCalled();
  });

  it('handles truncation with finish_reason length without repeating doomed calls and returns template within deadline', async () => {
    // Jarvis returns finish_reason length
    fakeJarvis.generateJson.mockResolvedValueOnce({
      text: '{"theme": "Incomplete',
      finishReason: 'length',
    });

    // Gemini also returns MAX_TOKENS finish reason
    fakeGemini.generateJson.mockResolvedValueOnce({
      text: '{"theme": "Also Incomplete',
      finishReason: 'MAX_TOKENS',
    });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_truncate' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    // Expect at most 2 attempts (1 per provider, 0 repair attempts on truncation)
    expect(res.meta.provider).toBe('template');
    expect(res.meta.attempts).toBe(2);
    expect(res.meta.repaired).toBe(false);
    expect(res.data).toEqual({ theme: 'Fallback Theme' });
    expect(res.meta.fallbackReason).toContain('truncated');
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(1);
    expect(fakeGemini.generateJson).toHaveBeenCalledTimes(1);
  });

  it('opens circuit breaker after 3 failures and skips provider until half-open reset', async () => {
    const error500 = new ProviderError({ kind: 'server', retryable: true, message: '500 error' });

    fakeJarvis.generateJson.mockRejectedValue(error500);
    fakeGemini.generateJson.mockResolvedValue({ text: validGeminiJson });

    const chain = createChain();

    // 3 failures trip Jarvis circuit breaker
    for (let i = 0; i < 3; i++) {
      await chain.executeSection({
        section: 'ideas',
        schema: testSchema,
        promptBuilder: () => ({ system: 'sys', user: `usr_${i}` }),
        fallbackGetter,
      });
    }

    expect(jarvisBreaker.getState()).toBe('open');
    expect(jarvisBreaker.isOpen()).toBe(true);

    // Call 4: Jarvis circuit breaker is OPEN, so Jarvis is skipped immediately
    fakeJarvis.generateJson.mockClear();
    fakeGemini.generateJson.mockClear();

    const call4 = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_call4' }),
      fallbackGetter,
    });

    expect(call4.meta.provider).toBe('gemini');
    expect(fakeJarvis.generateJson).not.toHaveBeenCalled(); // Skipped by circuit breaker

    // Advance time by 30 seconds -> half-open transition allows 1 probe
    currentTime += 30_001;
    expect(jarvisBreaker.getState()).toBe('half_open');

    fakeJarvis.generateJson.mockResolvedValueOnce({ text: validThemeJson });
    const call5 = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_call5' }),
      fallbackGetter,
    });

    expect(call5.meta.provider).toBe('jarvis');
    expect(jarvisBreaker.getState()).toBe('closed');
  });

  it('serves repeat requests from in-memory cache without regenerating', async () => {
    fakeJarvis.generateJson.mockResolvedValueOnce({ text: validThemeJson });
    const chain = createChain();

    // Request 1: hits provider
    const res1 = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_cache' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });
    expect(res1.meta.cached).toBe(false);
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(1);

    // Request 2: identical input serves from cache
    const res2 = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_cache' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });
    expect(res2.meta.cached).toBe(true);
    expect(res2.data).toEqual(res1.data);
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(1); // Not called again
  });

  it('triggers critic repair loop when critic returns approved: false with issues and succeeds with repaired: true', async () => {
    fakeJarvis.generateJson
      .mockResolvedValueOnce({ text: validThemeJson })
      .mockResolvedValueOnce({ text: JSON.stringify({ theme: 'Royal Heritage Repaired' }) });

    const criticMock = {
      isEnabled: () => true,
      evaluateSections: vi.fn().mockResolvedValueOnce({
        status: 'ran',
        verdict: {
          approved: false,
          issues: [{ section: 'ideas', problem: 'Lacks traditional marigold theme' }],
        },
      }),
    };

    const chain = createChain(criticMock);

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_critic' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Royal Heritage Repaired' });
    expect(res.meta.repaired).toBe(true);
    expect(res.meta.criticVerdict?.approved).toBe(false);
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(2);
  });

  it('honors rate_limit with short Retry-After <= 2s and succeeds on retry', async () => {
    const rateLimitErr = new ProviderError({
      kind: 'rate_limit',
      retryable: true,
      retryAfterSeconds: 1,
      message: 'Rate limit hit',
    });

    fakeJarvis.generateJson
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValueOnce({ text: validThemeJson });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_ratelimit' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Royal Heritage' });
    expect(res.meta.provider).toBe('jarvis');
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(2);
  });

  it('handles unexpected non-ProviderError thrown by provider and falls back cleanly', async () => {
    fakeJarvis.generateJson.mockRejectedValueOnce(
      new TypeError('Low-level socket unexpected closure')
    );
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_unexpected' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Gemini Garden' });
    expect(res.meta.provider).toBe('gemini');
  });

  it('honors forceProvider option to skip other providers when ALLOW_PROVIDER_OVERRIDE is true', async () => {
    process.env.ALLOW_PROVIDER_OVERRIDE = 'true';
    _resetEnvCacheForTesting();
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_force' }),
      fallbackGetter,
      profile: weddingPuneFixture,
      forceProvider: 'gemini',
    });

    expect(res.data).toEqual({ theme: 'Gemini Garden' });
    expect(res.meta.provider).toBe('gemini');
    expect(fakeJarvis.generateJson).not.toHaveBeenCalled();
    delete process.env.ALLOW_PROVIDER_OVERRIDE;
    _resetEnvCacheForTesting();
  });

  it('returns deadline error if remaining time before provider call is <= 500ms', async () => {
    let callCount = 0;
    const chain = new FailoverChain({
      jarvis: fakeJarvis as any,
      gemini: fakeGemini as any,
      now: () => {
        // First call sets startTime = 0, second call in tryProvider sees time = 14800 (remaining 200ms <= 500ms)
        callCount++;
        return callCount === 1 ? 0 : 14800;
      },
    });

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_short_deadline' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.meta.provider).toBe('template');
    expect(res.data).toEqual({ theme: 'Fallback Theme' });
    expect(fakeJarvis.generateJson).not.toHaveBeenCalled();
  });

  it('opens circuit breaker for 30 minutes on daily quota error', async () => {
    const dailyQuotaErr = new ProviderError({
      kind: 'rate_limit',
      retryable: false,
      isDailyQuota: true,
      message: 'Daily quota exhausted',
    });

    fakeJarvis.generateJson.mockRejectedValueOnce(dailyQuotaErr);
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_daily' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.meta.provider).toBe('gemini');
    expect(jarvisBreaker.isOpen()).toBe(true);
    expect(jarvisBreaker.getState()).toBe('open');
  });

  it('records failure and continues when repair attempt also fails validation', async () => {
    // Both attempts return invalid JSON schemas
    fakeJarvis.generateJson
      .mockResolvedValueOnce({ text: '{"invalid": 1}' })
      .mockResolvedValueOnce({ text: '{"stillInvalid": 2}' });
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_double_invalid' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.meta.provider).toBe('gemini');
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(2);
    expect(fakeGemini.generateJson).toHaveBeenCalledTimes(1);
  });

  it('handles error thrown during repair attempt and continues to failover', async () => {
    fakeJarvis.generateJson
      .mockResolvedValueOnce({ text: '{"invalid": 1}' })
      .mockRejectedValueOnce(new Error('Network aborted during repair'));
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_repair_throws' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.meta.provider).toBe('gemini');
    expect(fakeGemini.generateJson).toHaveBeenCalledTimes(1);
  });

  it('falls over when rate limit retry attempt itself throws or fails', async () => {
    const rateLimitErr = new ProviderError({
      kind: 'rate_limit',
      retryable: true,
      retryAfterSeconds: 1,
      message: 'Rate limit hit',
    });

    fakeJarvis.generateJson
      .mockRejectedValueOnce(rateLimitErr)
      .mockRejectedValueOnce(new Error('Second retry failed'));
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_retry_fails' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.meta.provider).toBe('gemini');
    expect(fakeGemini.generateJson).toHaveBeenCalledTimes(1);
  });

  it('honors forceProvider: template option to skip all LLMs immediately', async () => {
    process.env.ALLOW_PROVIDER_OVERRIDE = 'true';
    _resetEnvCacheForTesting();

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_force_template' }),
      fallbackGetter,
      profile: weddingPuneFixture,
      forceProvider: 'template',
    });

    expect(res.meta.provider).toBe('template');
    expect(res.data).toEqual({ theme: 'Fallback Theme' });
    expect(fakeJarvis.generateJson).not.toHaveBeenCalled();
    expect(fakeGemini.generateJson).not.toHaveBeenCalled();

    delete process.env.ALLOW_PROVIDER_OVERRIDE;
    _resetEnvCacheForTesting();
  });

  it('honors forceProvider: jarvis option to isolate Jarvis evaluation', async () => {
    process.env.ALLOW_PROVIDER_OVERRIDE = 'true';
    _resetEnvCacheForTesting();

    fakeJarvis.generateJson.mockResolvedValueOnce({ text: validThemeJson });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_force_jarvis' }),
      fallbackGetter,
      profile: weddingPuneFixture,
      forceProvider: 'jarvis',
    });

    expect(res.meta.provider).toBe('jarvis');
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(1);
    expect(fakeGemini.generateJson).not.toHaveBeenCalled();

    delete process.env.ALLOW_PROVIDER_OVERRIDE;
    _resetEnvCacheForTesting();
  });

  it('handles unbalanced truncated JSON parse errors as truncation traps', async () => {
    fakeJarvis.generateJson.mockResolvedValueOnce({
      text: '{"theme": "Unfinished string',
      finishReason: 'stop',
    });
    fakeGemini.generateJson.mockResolvedValueOnce({ text: validGeminiJson });

    const chain = createChain();

    const res = await chain.executeSection({
      section: 'ideas',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_unbalanced' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.meta.provider).toBe('gemini');
    expect(fakeJarvis.generateJson).toHaveBeenCalledTimes(1); // No doomed repair attempt on truncated JSON
  });

  it('runs critic successfully for menu section as well as ideas', async () => {
    fakeJarvis.generateJson.mockResolvedValueOnce({ text: validThemeJson });

    const criticMock = {
      isEnabled: () => true,
      evaluateSections: vi.fn().mockResolvedValueOnce({
        status: 'ran',
        verdict: { approved: true, issues: [] },
      }),
    };

    const chain = createChain(criticMock);

    const res = await chain.executeSection({
      section: 'menu',
      schema: testSchema,
      promptBuilder: () => ({ system: 'sys', user: 'usr_menu' }),
      fallbackGetter,
      profile: weddingPuneFixture,
    });

    expect(res.data).toEqual({ theme: 'Royal Heritage' });
    expect(res.meta.provider).toBe('jarvis');
    expect(criticMock.evaluateSections).toHaveBeenCalledTimes(1);
  });

  describe('meta.model contract across providers', () => {
    it('sets meta.model to Jarvis model id when provider is jarvis', async () => {
      fakeJarvis.generateJson.mockResolvedValueOnce({ text: validThemeJson });

      const chain = createChain();
      const res = await chain.executeSection({
        section: 'ideas',
        schema: testSchema,
        promptBuilder: () => ({ system: 'sys', user: 'usr' }),
        fallbackGetter,
      });

      expect(res.meta.provider).toBe('jarvis');
      expect(res.meta.model).toBe('gemma-4-31b-it');
    });

    it('sets meta.model to Gemini model id when provider is gemini', async () => {
      // Force gemini provider
      fakeGemini.generateJson.mockResolvedValueOnce({ text: validThemeJson });

      const chain = createChain();
      const res = await chain.executeSection({
        section: 'ideas',
        schema: testSchema,
        promptBuilder: () => ({ system: 'sys', user: 'usr' }),
        fallbackGetter,
        forceProvider: 'gemini',
      });

      expect(res.meta.provider).toBe('gemini');
      expect(res.meta.model).toBe('gemini-2.5-flash');
    });

    it('sets meta.model to null when falling back to template', async () => {
      // Both fail -> template fallback
      fakeJarvis.generateJson.mockRejectedValue(new Error('Jarvis down'));
      fakeGemini.generateJson.mockRejectedValue(new Error('Gemini down'));

      const chain = createChain();
      const res = await chain.executeSection({
        section: 'ideas',
        schema: testSchema,
        promptBuilder: () => ({ system: 'sys', user: 'usr' }),
        fallbackGetter,
      });

      expect(res.meta.provider).toBe('template');
      expect(res.meta.model).toBeNull();
    });
  });
});
