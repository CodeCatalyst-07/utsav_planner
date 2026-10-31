import { describe, it, expect, beforeEach } from 'vitest';
import { POST as planPost } from '@/app/api/plan/route';
import { POST as replanPost } from '@/app/api/plan/replan/route';
import { POST as sectionPost } from '@/app/api/ai/section/route';
import { POST as chatPost } from '@/app/api/ai/chat/route';
import { GET as vendorsGet } from '@/app/api/vendors/route';
import { POST as icsPost } from '@/app/api/calendar/ics/route';
import { POST as linksPost } from '@/app/api/calendar/links/route';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';
import { llmRateLimiter, nonLlmRateLimiter } from '@/server/apiHelper';

function makeRequest(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Request {
  const { method = 'POST', body, headers = {} } = options;
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new Request(`http://localhost:3000${path}`, init);
}

describe('API Route Handlers (src/app/api/)', () => {
  describe('POST /api/plan', () => {
    it('returns 200 with deterministic plan computed server-side', async () => {
      const req = makeRequest('/api/plan', {
        body: { profile: weddingPuneFixture },
      });

      const res = await planPost(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-request-id')).toBeDefined();

      const json = await res.json();
      expect(json).toHaveProperty('plan');
      expect(json.plan.budget.total).toBe(4_000_000);
    });

    it('returns 400 with field errors on invalid profile input', async () => {
      const req = makeRequest('/api/plan', {
        body: { profile: { ...weddingPuneFixture, guestCount: -20 } },
      });

      const res = await planPost(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details).toBeDefined();
    });

    it('returns 413 when payload exceeds request size limit', async () => {
      const hugeString = 'a'.repeat(20 * 1024); // 20KB > 16KB limit
      const req = makeRequest('/api/plan', {
        body: { profile: weddingPuneFixture, oversizedField: hugeString },
      });

      const res = await planPost(req);
      expect(res.status).toBe(413);

      const json = await res.json();
      expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('POST /api/plan/replan', () => {
    it('returns 200 with updated plan and diff', async () => {
      const req = makeRequest('/api/plan/replan', {
        body: {
          profile: weddingPuneFixture,
          patch: { totalBudgetInr: 5_000_000 },
        },
      });

      const res = await replanPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('plan');
      expect(json).toHaveProperty('diff');
      expect(json.diff.totalDelta).toBe(1_000_000);
      expect(json.plan.budget.total).toBe(5_000_000);
    });

    it('returns 400 on invalid patch values', async () => {
      const req = makeRequest('/api/plan/replan', {
        body: {
          profile: weddingPuneFixture,
          patch: { guestCount: -5 },
        },
      });

      const res = await replanPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/ai/section', () => {
    it('returns 200 with data and metadata using deterministic fallback when providers unconfigured', async () => {
      const req = makeRequest('/api/ai/section', {
        body: {
          profile: weddingPuneFixture,
          section: 'ideas',
        },
      });

      const res = await sectionPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('meta');
      expect(json.data.themes).toHaveLength(3);
      expect(json.meta.provider).toBe('template');
    });

    it('returns 400 when section name is invalid', async () => {
      const req = makeRequest('/api/ai/section', {
        body: {
          profile: weddingPuneFixture,
          section: 'invalid_section_name',
        },
      });

      const res = await sectionPost(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/ai/chat', () => {
    it('returns 200 with conversational reply for planning questions', async () => {
      const req = makeRequest('/api/ai/chat', {
        body: {
          profile: weddingPuneFixture,
          message: 'What are traditional wedding favors in Pune?',
        },
      });

      const res = await chatPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('reply');
      expect(json).toHaveProperty('meta');
    });

    it('returns 400 when chat message exceeds 500 characters', async () => {
      const longMessage = 'x'.repeat(505);
      const req = makeRequest('/api/ai/chat', {
        body: {
          profile: weddingPuneFixture,
          message: longMessage,
        },
      });

      const res = await chatPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/vendors', () => {
    it('returns 200 with vendor search results and Google Maps search link', async () => {
      const req = makeRequest('/api/vendors?categoryId=catering&city=Pune&tier=tier1', {
        method: 'GET',
      });

      const res = await vendorsGet(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.source).toBe('sample');
      expect(json.vendors.length).toBeGreaterThanOrEqual(3);
      expect(json.mapsUrl).toContain('google.com/maps/search');
    });

    it('returns 400 when categoryId query param is missing', async () => {
      const req = makeRequest('/api/vendors?city=Pune', {
        method: 'GET',
      });

      const res = await vendorsGet(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/calendar/ics & /api/calendar/links', () => {
    it('returns text/calendar attachment for /api/calendar/ics', async () => {
      const req = makeRequest('/api/calendar/ics', {
        body: { profile: weddingPuneFixture },
      });

      const res = await icsPost(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/calendar');
      expect(res.headers.get('content-disposition')).toContain('attachment');

      const text = await res.text();
      expect(text).toContain('BEGIN:VCALENDAR');
      expect(text).toContain('END:VCALENDAR');
    });

    it('returns JSON array of milestone template links for /api/calendar/links', async () => {
      const req = makeRequest('/api/calendar/links', {
        body: { profile: weddingPuneFixture },
      });

      const res = await linksPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('links');
      expect(json.links.length).toBeGreaterThan(0);
      expect(json.links[0]).toHaveProperty('googleCalendarUrl');
      expect(json.links[0].googleCalendarUrl).toContain('calendar.google.com');
    });
  });

  describe('Route-Level Rate Limiting, Override Protection & Error Sanitization', () => {
    beforeEach(() => {
      llmRateLimiter.reset();
      nonLlmRateLimiter.reset();
    });

    it('enforces 429 + Retry-After for LLM routes when limit of 10/min is exceeded', async () => {
      const clientIp = '192.168.1.100';
      // Send 10 allowed requests
      for (let i = 0; i < 10; i++) {
        const req = makeRequest('/api/ai/section', {
          headers: { 'x-forwarded-for': clientIp },
          body: { profile: weddingPuneFixture, section: 'ideas' },
        });
        const res = await sectionPost(req);
        expect(res.status).toBe(200);
      }

      // 11th request from same IP must be rejected with HTTP 429
      const blockedReq = makeRequest('/api/ai/section', {
        headers: { 'x-forwarded-for': clientIp },
        body: { profile: weddingPuneFixture, section: 'ideas' },
      });
      const blockedRes = await sectionPost(blockedReq);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('retry-after')).toBeDefined();
      const retrySeconds = parseInt(blockedRes.headers.get('retry-after') || '0', 10);
      expect(retrySeconds).toBeGreaterThan(0);

      const json = await blockedRes.json();
      expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(json.error.message).toContain('Rate limit exceeded');
    });

    it('enforces separate non-LLM rate limit (60/min) on general routes', async () => {
      const clientIp = '192.168.1.101';
      for (let i = 0; i < 60; i++) {
        const req = makeRequest('/api/plan', {
          headers: { 'x-forwarded-for': clientIp },
          body: { profile: weddingPuneFixture },
        });
        const res = await planPost(req);
        expect(res.status).toBe(200);
      }

      // 61st request triggers 429
      const blockedReq = makeRequest('/api/plan', {
        headers: { 'x-forwarded-for': clientIp },
        body: { profile: weddingPuneFixture },
      });
      const blockedRes = await planPost(blockedReq);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('retry-after')).toBeDefined();
      const json = await blockedRes.json();
      expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('ignores x-force-provider when ALLOW_PROVIDER_OVERRIDE is false (default)', async () => {
      // By default, ALLOW_PROVIDER_OVERRIDE is false.
      // Even if client specifies x-force-provider: jarvis, default failover resolves cleanly
      const req = makeRequest('/api/ai/section', {
        headers: { 'x-force-provider': 'jarvis' },
        body: { profile: weddingPuneFixture, section: 'ideas' },
      });
      const res = await sectionPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      // Unconfigured in unit test -> should cleanly fall back to template rather than crash or hang
      expect(json.meta.provider).toBe('template');
    });

    it('never leaks stack traces, source file paths, or raw provider bodies in error responses', async () => {
      const malformedReq = makeRequest('/api/plan', {
        body: 'invalid-json-syntax',
      });
      const res = await planPost(malformedReq);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('INVALID_JSON');
      expect(json.error.requestId).toBeDefined();

      const rawResponseText = JSON.stringify(json);
      expect(rawResponseText).not.toContain('stack');
      expect(rawResponseText).not.toContain('at Object');
      expect(rawResponseText).not.toContain('/Users/');
      expect(rawResponseText).not.toContain('.ts:');
    });

    it('returns 413 PAYLOAD_TOO_LARGE when body exceeds 16KB', async () => {
      const oversizedText = 'X'.repeat(17 * 1024); // 17KB > 16KB cap
      const req = makeRequest('/api/ai/section', {
        body: { profile: weddingPuneFixture, section: 'ideas', padding: oversizedText },
      });
      const res = await sectionPost(req);
      expect(res.status).toBe(413);

      const json = await res.json();
      expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });
});
