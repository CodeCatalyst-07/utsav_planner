import 'server-only';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitBucketOptions {
  limit: number; // max tokens in window
  windowMs: number; // window duration in ms
  dailyLimit?: number; // optional daily hard cap
  now?: () => number;
}

interface BucketRecord {
  tokens: number;
  lastRefill: number;
  dailyCount: number;
  dayStart: number;
}

/**
 * In-Memory Token Bucket Rate Limiter.
 * NOTE: In-memory limits operate per serverless instance.
 * For horizontally scaled multi-region serverless production,
 * Upstash Redis / Cloudflare KV is the documented upgrade path.
 */
export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, BucketRecord>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly dailyLimit: number;
  private readonly now: () => number;

  constructor(options: RateLimitBucketOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.dailyLimit = options.dailyLimit ?? options.limit * 15;
    this.now = options.now ?? (() => Date.now());
  }

  check(key: string): RateLimitResult {
    const currentTime = this.now();
    let record = this.buckets.get(key);

    const oneDayMs = 86_400_000;

    if (!record) {
      record = {
        tokens: this.limit,
        lastRefill: currentTime,
        dailyCount: 0,
        dayStart: currentTime,
      };
      this.buckets.set(key, record);
    }

    // Reset daily counter if a day has passed
    if (currentTime - record.dayStart >= oneDayMs) {
      record.dailyCount = 0;
      record.dayStart = currentTime;
    }

    // Check daily hard cap
    if (record.dailyCount >= this.dailyLimit) {
      const remainingDaySeconds = Math.max(
        1,
        Math.ceil((oneDayMs - (currentTime - record.dayStart)) / 1000)
      );
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: remainingDaySeconds,
      };
    }

    // Refill tokens based on elapsed time
    const elapsed = currentTime - record.lastRefill;
    const tokensToAdd = (elapsed / this.windowMs) * this.limit;
    record.tokens = Math.min(this.limit, record.tokens + tokensToAdd);
    record.lastRefill = currentTime;

    if (record.tokens >= 1) {
      record.tokens -= 1;
      record.dailyCount += 1;
      return {
        allowed: true,
        remaining: Math.floor(record.tokens),
        retryAfterSeconds: 0,
      };
    }

    // Denied: calculate wait time until 1 token is refilled
    const tokensNeeded = 1 - record.tokens;
    const timeNeededMs = (tokensNeeded / this.limit) * this.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil(timeNeededMs / 1000));

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

/**
 * Extracts client identifier from request headers.
 * Uses first hop of X-Forwarded-For to prevent spoofing, or falls back to 'anonymous'.
 */
export function getClientIp(headers?: Headers): string {
  if (!headers) return 'anonymous';

  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const firstHop = xff.split(',')[0]?.trim();
    if (firstHop && firstHop.length > 0) {
      // Basic IP sanitization
      return firstHop.replace(/[^a-zA-Z0-9.:]/g, '').slice(0, 45);
    }
  }

  const realIp = headers.get('x-real-ip');
  if (realIp && realIp.trim().length > 0) {
    return realIp
      .trim()
      .replace(/[^a-zA-Z0-9.:]/g, '')
      .slice(0, 45);
  }

  return 'anonymous';
}
