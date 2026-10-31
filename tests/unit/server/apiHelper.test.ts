import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { checkRateLimit, parseRequestBody } from '@/server/apiHelper';
import { TokenBucketRateLimiter } from '@/server/security/rateLimit';

describe('API Helper (src/server/apiHelper.ts)', () => {
  const testSchema = z.object({
    name: z.string().min(2),
    count: z.number().int().positive(),
  });

  it('checkRateLimit allows requests under quota and returns 429 when exceeded', () => {
    const limiter = new TokenBucketRateLimiter({ limit: 1, windowMs: 60_000, dailyLimit: 10 });
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.1' },
    });

    // 1st request allowed
    const res1 = checkRateLimit(req, limiter, 'req_1');
    expect(res1).toBeNull();

    // 2nd request blocked
    const res2 = checkRateLimit(req, limiter, 'req_2');
    expect(res2).not.toBeNull();
    expect(res2?.status).toBe(429);
  });

  it('parseRequestBody rejects content-length exceeding maxSizeBytes', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        'content-length': '20000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'ok', count: 1 }),
    });

    const result = await parseRequestBody(req, testSchema, 'req_oversize', 1000);
    expect(result.data).toBeUndefined();
    expect(result.errorResponse?.status).toBe(413);
  });

  it('parseRequestBody handles invalid JSON payload', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"invalid": json',
    });

    const result = await parseRequestBody(req, testSchema, 'req_bad_json');
    expect(result.data).toBeUndefined();
    expect(result.errorResponse?.status).toBe(400);
  });

  it('parseRequestBody rejects payload failing Zod schema validation', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'A', count: -5 }),
    });

    const result = await parseRequestBody(req, testSchema, 'req_invalid_schema');
    expect(result.data).toBeUndefined();
    expect(result.errorResponse?.status).toBe(400);
  });

  it('parseRequestBody parses valid payload successfully', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Valid Name', count: 10 }),
    });

    const result = await parseRequestBody(req, testSchema, 'req_valid');
    expect(result.errorResponse).toBeUndefined();
    expect(result.data).toEqual({ name: 'Valid Name', count: 10 });
  });

  it('parseRequestBody rejects body text exceeding maxSizeBytes when header is absent', async () => {
    const longString = 'x'.repeat(200);
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: longString, count: 5 }),
    });

    const result = await parseRequestBody(req, testSchema, 'req_body_overflow', 50);
    expect(result.data).toBeUndefined();
    expect(result.errorResponse?.status).toBe(413);
  });
});
