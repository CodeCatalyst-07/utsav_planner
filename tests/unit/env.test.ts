import { describe, it, expect, beforeEach } from 'vitest';
import { parseEnv, getConfiguredProviders, getEnv, _resetEnvCacheForTesting } from '@/server/env';

describe('Server Environment Validation (src/server/env.ts)', () => {
  beforeEach(() => {
    _resetEnvCacheForTesting();
  });

  it('passes validation when no provider keys are provided (defaults apply)', () => {
    const emptyConfig = parseEnv({});

    expect(emptyConfig.VENDOR_SOURCE).toBe('sample');
    expect(emptyConfig.RATE_LIMIT_PER_MIN).toBe(10);
    expect(emptyConfig.JARVIS_BASE_URL).toBe('https://models.jarvislabs.net/v1');
    expect(emptyConfig.JARVIS_MODEL).toBe('gemma-4-31b-it');
    expect(emptyConfig.JARVIS_JSON_MODE).toBe('prompt_only');
    expect(emptyConfig.JARVIS_EXTRA_BODY_JSON).toEqual({});
    expect(emptyConfig.LLM_TIMEOUT_MS).toBe(20000);
    expect(emptyConfig.AI_CACHE_TTL_SECONDS).toBe(1800);
    expect(emptyConfig.CRITIC_ENABLED).toBe(false);
    expect(emptyConfig.GROUNDING_ENABLED).toBe(false);
    expect(emptyConfig.ALLOW_PROVIDER_OVERRIDE).toBe(false);
    expect(emptyConfig.GEMINI_API_KEY).toBeUndefined();
    expect(emptyConfig.GEMINI_MODEL).toBeUndefined();
    expect(emptyConfig.JARVISLABS_API_KEY).toBeUndefined();
    expect(emptyConfig.GOOGLE_PLACES_API_KEY).toBeUndefined();

    const providers = getConfiguredProviders(emptyConfig);
    expect(providers).toEqual({
      gemini: false,
      jarvis: false,
      googlePlaces: false,
    });
  });

  it('correctly reports configured providers when valid keys are set', () => {
    const validConfig = parseEnv({
      GEMINI_API_KEY: 'secret-gemini-key-12345',
      GEMINI_MODEL: 'gemini-2.5-flash',
      JARVISLABS_API_KEY: 'secret-jarvis-key-67890',
    });

    const providers = getConfiguredProviders(validConfig);
    expect(providers.gemini).toBe(true);
    expect(providers.jarvis).toBe(true);
    expect(providers.googlePlaces).toBe(false);
  });

  it('fails validation when GEMINI_API_KEY is provided without GEMINI_MODEL', () => {
    const secretApiKey = 'super-secret-gemini-key-xyz';

    expect(() =>
      parseEnv({
        GEMINI_API_KEY: secretApiKey,
      })
    ).toThrowError(/GEMINI_MODEL/);

    // Verify secret API key is NEVER leaked in the error message
    try {
      parseEnv({
        GEMINI_API_KEY: secretApiKey,
      });
    } catch (err) {
      const errorMsg = (err as Error).message;
      expect(errorMsg).toContain('GEMINI_MODEL');
      expect(errorMsg).not.toContain(secretApiKey);
    }
  });

  it('fails validation when VENDOR_SOURCE=places but GOOGLE_PLACES_API_KEY is missing', () => {
    expect(() =>
      parseEnv({
        VENDOR_SOURCE: 'places',
      })
    ).toThrowError(/GOOGLE_PLACES_API_KEY/);
  });

  it('fails validation when VENDOR_SOURCE=gemini is used (gemini removed from VENDOR_SOURCE enum)', () => {
    expect(() =>
      parseEnv({
        VENDOR_SOURCE: 'gemini',
      })
    ).toThrowError(/VENDOR_SOURCE/);
  });

  it('parses valid JARVIS_EXTRA_BODY_JSON correctly', () => {
    const config = parseEnv({
      JARVIS_EXTRA_BODY_JSON: JSON.stringify({ enable_thinking: false, max_tokens: 1024 }),
    });
    expect(config.JARVIS_EXTRA_BODY_JSON).toEqual({
      enable_thinking: false,
      max_tokens: 1024,
    });
  });

  it('fails validation on invalid JARVIS_EXTRA_BODY_JSON without leaking contents', () => {
    expect(() =>
      parseEnv({
        JARVIS_EXTRA_BODY_JSON: 'not-valid-json',
      })
    ).toThrowError(/JARVIS_EXTRA_BODY_JSON/);
  });

  it('passes validation when VENDOR_SOURCE=places and GOOGLE_PLACES_API_KEY is provided', () => {
    const config = parseEnv({
      VENDOR_SOURCE: 'places',
      GOOGLE_PLACES_API_KEY: 'my-google-places-key',
    });

    expect(config.VENDOR_SOURCE).toBe('places');
    expect(getConfiguredProviders(config).googlePlaces).toBe(true);
  });

  it('fails validation with invalid RATE_LIMIT_PER_MIN and does not leak value', () => {
    const secretLeakingValue = 'negative-invalid-secret-value';

    try {
      parseEnv({
        RATE_LIMIT_PER_MIN: '-5',
      });
    } catch (err) {
      const errorMsg = (err as Error).message;
      expect(errorMsg).toContain('RATE_LIMIT_PER_MIN');
      expect(errorMsg).not.toContain(secretLeakingValue);
    }
  });

  it('treats empty and whitespace-only strings as unset for all optional variables', () => {
    const configWithEmptyStrings = parseEnv({
      JARVISLABS_API_KEY: '',
      GEMINI_API_KEY: '',
      GEMINI_MODEL: '',
      GEMINI_THINKING_BUDGET: '',
      GOOGLE_PLACES_API_KEY: '',
      RATE_LIMIT_PER_MIN: '',
      LLM_TIMEOUT_MS: '',
      AI_TOTAL_DEADLINE_MS: '',
      AI_CACHE_TTL_SECONDS: '',
      JARVIS_EXTRA_BODY_JSON: '',
    });

    expect(configWithEmptyStrings.JARVISLABS_API_KEY).toBeUndefined();
    expect(configWithEmptyStrings.GEMINI_API_KEY).toBeUndefined();
    expect(configWithEmptyStrings.GEMINI_MODEL).toBeUndefined();
    expect(configWithEmptyStrings.GEMINI_THINKING_BUDGET).toBeUndefined();
    expect(configWithEmptyStrings.GOOGLE_PLACES_API_KEY).toBeUndefined();
    expect(configWithEmptyStrings.RATE_LIMIT_PER_MIN).toBe(10);
    expect(configWithEmptyStrings.LLM_TIMEOUT_MS).toBe(20000);
    expect(configWithEmptyStrings.AI_TOTAL_DEADLINE_MS).toBe(15000);
    expect(configWithEmptyStrings.AI_CACHE_TTL_SECONDS).toBe(1800);
    expect(configWithEmptyStrings.JARVIS_EXTRA_BODY_JSON).toEqual({});

    const providersEmpty = getConfiguredProviders(configWithEmptyStrings);
    expect(providersEmpty).toEqual({
      gemini: false,
      jarvis: false,
      googlePlaces: false,
    });

    const configWithSpaces = parseEnv({
      JARVISLABS_API_KEY: '   ',
      GEMINI_API_KEY: '   ',
      GEMINI_MODEL: '   ',
      GEMINI_THINKING_BUDGET: '   ',
      GOOGLE_PLACES_API_KEY: '   ',
      RATE_LIMIT_PER_MIN: '   ',
      LLM_TIMEOUT_MS: '   ',
      AI_TOTAL_DEADLINE_MS: '   ',
      AI_CACHE_TTL_SECONDS: '   ',
      JARVIS_EXTRA_BODY_JSON: '   ',
    });

    expect(configWithSpaces.JARVISLABS_API_KEY).toBeUndefined();
    expect(configWithSpaces.GEMINI_API_KEY).toBeUndefined();
    expect(configWithSpaces.GEMINI_MODEL).toBeUndefined();
    expect(configWithSpaces.GEMINI_THINKING_BUDGET).toBeUndefined();
    expect(configWithSpaces.GOOGLE_PLACES_API_KEY).toBeUndefined();
    expect(configWithSpaces.RATE_LIMIT_PER_MIN).toBe(10);
    expect(configWithSpaces.LLM_TIMEOUT_MS).toBe(20000);
    expect(configWithSpaces.AI_TOTAL_DEADLINE_MS).toBe(15000);
    expect(configWithSpaces.AI_CACHE_TTL_SECONDS).toBe(1800);
    expect(configWithSpaces.JARVIS_EXTRA_BODY_JSON).toEqual({});

    const providersSpaces = getConfiguredProviders(configWithSpaces);
    expect(providersSpaces).toEqual({
      gemini: false,
      jarvis: false,
      googlePlaces: false,
    });
  });

  it('getEnv() memoizes result and allows app/health to work without keys', () => {
    const env = getEnv();
    expect(env).toBeDefined();
    expect(env.VENDOR_SOURCE).toBe('sample');
  });
});
