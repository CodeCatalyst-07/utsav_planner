import 'server-only';
import { createHash } from 'node:crypto';

export interface CacheOptions {
  maxSize?: number; // default: 200
  ttlSeconds?: number; // default: 1800
  now?: () => number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Computes deterministic SHA256 cache key for an AI generation request.
 */
export function buildCacheKey(
  section: string,
  normalizedInputs: unknown,
  promptVersion: string,
  modelNames: string
): string {
  const content = JSON.stringify({
    section,
    inputs: normalizedInputs,
    promptVersion,
    modelNames,
  });
  return createHash('sha256').update(content).digest('hex');
}

/**
 * In-memory LRU cache with TTL and in-flight request de-duplication.
 * NOTE: Serverless instances are ephemeral; this cache de-duplicates concurrent UI
 * requests and amortizes repeat queries within the same serverless worker lifetime.
 */
export class AICache {
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(options?: CacheOptions) {
    this.maxSize = options?.maxSize ?? 200;
    this.ttlMs = (options?.ttlSeconds ?? 1800) * 1000;
    this.now = options?.now ?? (() => Date.now());
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (this.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh LRU order by delete and set
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first item in insertion order)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  /**
   * Executes fetcher with in-flight request de-duplication.
   * Concurrent identical requests share the same in-flight Promise.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<{ value: T; cached: boolean }> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return { value: cached, cached: true };
    }

    const inFlightPromise = this.inFlight.get(key);
    if (inFlightPromise) {
      const value = (await inFlightPromise) as T;
      return { value, cached: true };
    }

    const fetchPromise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result);
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    const value = await fetchPromise;
    return { value, cached: false };
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const globalAICache = new AICache();
