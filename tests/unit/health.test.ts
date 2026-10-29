import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { _resetEnvCacheForTesting } from '@/server/env';

describe('GET /api/health Endpoint (src/app/api/health/route.ts)', () => {
  beforeEach(() => {
    _resetEnvCacheForTesting();
  });

  it('returns HTTP 200 with ok status and boolean provider flags', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('providers');
    expect(data.providers).toEqual({
      gemini: false,
      jarvis: false,
      googlePlaces: false,
    });
    expect(data).toHaveProperty('vendorSource', 'sample');

    // Asserts zero secrets or keys are returned
    expect(data).not.toHaveProperty('GEMINI_API_KEY');
    expect(data).not.toHaveProperty('JARVISLABS_API_KEY');
    expect(data).not.toHaveProperty('GOOGLE_PLACES_API_KEY');
    const jsonString = JSON.stringify(data);
    expect(jsonString).not.toContain('secret');
    expect(jsonString).not.toContain('key');
  });
});
