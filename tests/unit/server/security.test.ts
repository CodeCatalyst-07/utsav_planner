import { describe, it, expect, vi } from 'vitest';
import { TokenBucketRateLimiter, getClientIp } from '@/server/security/rateLimit';
import { CircuitBreaker } from '@/server/security/circuitBreaker';
import { getOrCreateRequestId } from '@/server/security/requestId';
import { StructuredLogger, createErrorResponse } from '@/server/security/logger';

describe('Security Utilities (src/server/security/)', () => {
  describe('TokenBucketRateLimiter (rateLimit.ts)', () => {
    it('allows requests within capacity and tracks remaining tokens', () => {
      let now = 100_000;
      const limiter = new TokenBucketRateLimiter({
        limit: 3,
        windowMs: 60_000,
        now: () => now,
      });

      expect(limiter.check('ip_1').allowed).toBe(true);
      expect(limiter.check('ip_1').allowed).toBe(true);
      expect(limiter.check('ip_1').allowed).toBe(true);

      // 4th request within same second exceeds limit
      const denied = limiter.check('ip_1');
      expect(denied.allowed).toBe(false);
      expect(denied.remaining).toBe(0);
      expect(denied.retryAfterSeconds).toBeGreaterThan(0);

      // Advance time by 30 seconds -> 1.5 tokens refilled
      now += 30_000;
      const refilled = limiter.check('ip_1');
      expect(refilled.allowed).toBe(true);
    });

    it('enforces daily hard cap and reports retryAfterSeconds to day boundary', () => {
      let now = 100_000;
      const limiter = new TokenBucketRateLimiter({
        limit: 2,
        windowMs: 1_000,
        dailyLimit: 4,
        now: () => now,
      });

      // Consume 4 tokens over 4 seconds
      for (let i = 0; i < 4; i++) {
        expect(limiter.check('ip_daily').allowed).toBe(true);
        now += 1_000;
      }

      // 5th request exceeds dailyLimit
      const blocked = limiter.check('ip_daily');
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(3600); // multiple hours
    });

    it('extracts first hop from x-forwarded-for to defeat client header spoofing', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18, 150.172.238.178');

      const ip = getClientIp(headers);
      expect(ip).toBe('203.0.113.195');
    });

    it('prefers x-vercel-forwarded-for over x-forwarded-for when running on Vercel', () => {
      const headers = new Headers();
      headers.set('x-vercel-forwarded-for', '198.51.100.99, 10.0.0.1');
      headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18');

      const ip = getClientIp(headers);
      expect(ip).toBe('198.51.100.99');
    });

    it('enforces custom daily limit of 60 requests/client/day on token bucket', () => {
      let now = 1_000_000;
      const limiter = new TokenBucketRateLimiter({
        limit: 10,
        windowMs: 1_000, // fast refill to test daily cap independently
        dailyLimit: 60,
        now: () => now,
      });

      // Consume 60 requests across 6 seconds
      for (let i = 0; i < 60; i++) {
        now += 150;
        const res = limiter.check('test-client');
        expect(res.allowed).toBe(true);
      }

      // 61st request must be denied by daily cap
      now += 200;
      const blocked = limiter.check('test-client');
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('falls back to x-real-ip or anonymous when headers are missing', () => {
      const realIpHeaders = new Headers();
      realIpHeaders.set('x-real-ip', '198.51.100.25');
      expect(getClientIp(realIpHeaders)).toBe('198.51.100.25');

      expect(getClientIp(new Headers())).toBe('anonymous');
      expect(getClientIp(undefined)).toBe('anonymous');
    });
  });

  describe('CircuitBreaker (circuitBreaker.ts)', () => {
    it('opens after 3 failures and transitions to half_open after timeout', () => {
      let now = 100_000;
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30_000,
        now: () => now,
      });

      expect(breaker.getState()).toBe('closed');
      expect(breaker.canExecute()).toBe(true);

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('closed');

      breaker.recordFailure(); // 3rd failure
      expect(breaker.getState()).toBe('open');
      expect(breaker.canExecute()).toBe(false);
      expect(breaker.isOpen()).toBe(true);

      // Advance time by 29 seconds (still open)
      now += 29_000;
      expect(breaker.getState()).toBe('open');

      // Advance time past 30 seconds -> half_open
      now += 2_000;
      expect(breaker.getState()).toBe('half_open');
      expect(breaker.canExecute()).toBe(true);

      // Success in half_open closes the circuit
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('closed');
      expect(breaker.canExecute()).toBe(true);
    });

    it('re-opens immediately if probe fails in half_open state', () => {
      let now = 100_000;
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30_000,
        now: () => now,
      });

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');

      // Advance to half_open
      now += 30_001;
      expect(breaker.getState()).toBe('half_open');

      // Probe failure
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');
    });

    it('opens immediately for explicit custom duration via openFor()', () => {
      let now = 100_000;
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30_000,
        now: () => now,
      });

      // Open explicitly for 5 minutes (300,000 ms)
      breaker.openFor(300_000);
      expect(breaker.getState()).toBe('open');
      expect(breaker.isOpen()).toBe(true);

      // Advance by 2 minutes (120,000 ms) -> still open
      now += 120_000;
      expect(breaker.getState()).toBe('open');

      // Advance past 5 minutes -> half_open
      now += 185_000;
      expect(breaker.getState()).toBe('half_open');
      expect(breaker.canExecute()).toBe(true);
    });

    it('resets cleanly to closed on reset()', () => {
      const breaker = new CircuitBreaker();
      breaker.openFor(60_000);
      expect(breaker.isOpen()).toBe(true);

      breaker.reset();
      expect(breaker.getState()).toBe('closed');
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('StructuredLogger & Error Responses (logger.ts)', () => {
    it('formats structured log entries as valid JSON without sensitive contents', () => {
      const loggerInstance = new StructuredLogger();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      loggerInstance.info({
        requestId: 'req_123',
        route: '/api/ai/section',
        provider: 'jarvis',
        attempts: 1,
        valid: true,
        latencyMs: 320,
        status: 200,
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logString = consoleSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(logString);

      expect(parsed.level).toBe('INFO');
      expect(parsed.requestId).toBe('req_123');
      expect(parsed.route).toBe('/api/ai/section');
      expect(parsed.latencyMs).toBe(320);

      // Invariant: Prompt or key fields must never exist in log schema
      expect(parsed).not.toHaveProperty('prompt');
      expect(parsed).not.toHaveProperty('apiKey');
      expect(parsed).not.toHaveProperty('notes');

      consoleSpy.mockRestore();
    });

    it('creates standardized error responses without stack traces', async () => {
      const response = createErrorResponse(
        400,
        'BAD_REQUEST',
        'Invalid parameters provided',
        'req_test_123'
      );

      expect(response.status).toBe(400);
      expect(response.headers.get('x-request-id')).toBe('req_test_123');

      const body = await response.json();
      expect(body).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid parameters provided',
          requestId: 'req_test_123',
        },
      });

      // Verifies zero stack traces or internal secrets
      expect(body).not.toHaveProperty('stack');
      expect(body.error).not.toHaveProperty('stack');
    });
  });

  describe('RequestId Generator (requestId.ts)', () => {
    it('generates random alphanumeric request IDs', () => {
      const id1 = getOrCreateRequestId();
      const id2 = getOrCreateRequestId();
      expect(id1).toMatch(/^req_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^req_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    it('extracts and sanitizes existing x-request-id from headers', () => {
      const headers = new Headers();
      headers.set('x-request-id', 'client-trace-1234;drop table');

      const id = getOrCreateRequestId(headers);
      expect(id).toBe('client-trace-1234droptable');
    });
  });
});
