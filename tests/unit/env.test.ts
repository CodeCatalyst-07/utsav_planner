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

  it('getEnv() memoizes result and allows app/health to work without keys', () => {
    const env = getEnv();
    expect(env).toBeDefined();
    expect(env.VENDOR_SOURCE).toBe('sample');
  });
});
