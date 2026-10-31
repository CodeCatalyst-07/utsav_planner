import { describe, it, expect } from 'vitest';
import { AICache, buildCacheKey } from '@/server/ai/cache';

describe('AICache (src/server/ai/cache.ts)', () => {
  it('buildCacheKey generates deterministic SHA256 hashes', () => {
    const key1 = buildCacheKey('ideas', { city: 'Pune' }, 'v1.0.0', 'gemma');
    const key2 = buildCacheKey('ideas', { city: 'Pune' }, 'v1.0.0', 'gemma');
    const key3 = buildCacheKey('ideas', { city: 'Mumbai' }, 'v1.0.0', 'gemma');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('stores and retrieves cached values within TTL', () => {
    let mockTime = 1000;
    const cache = new AICache({
      maxSize: 10,
      ttlSeconds: 60,
      now: () => mockTime,
    });

    cache.set('key1', { test: 'val1' });
    expect(cache.get('key1')).toEqual({ test: 'val1' });
    expect(cache.size()).toBe(1);

    // Advance time within TTL
    mockTime += 30_000;
    expect(cache.get('key1')).toEqual({ test: 'val1' });

    // Advance time past TTL
    mockTime += 31_000;
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.size()).toBe(0);
  });

  it('evicts oldest entries when maxSize is reached (LRU policy)', () => {
    const cache = new AICache({ maxSize: 3, ttlSeconds: 60 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size()).toBe(3);

    // Access 'a' so it becomes most recently used
    expect(cache.get('a')).toBe(1);

    // Add 'd', which should evict 'b' (oldest)
    cache.set('d', 4);
    expect(cache.size()).toBe(3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('overwriting an existing key refreshes its entry without evicting others', () => {
    const cache = new AICache({ maxSize: 2, ttlSeconds: 60 });
    cache.set('x', 10);
    cache.set('y', 20);

    // Update existing 'x'
    cache.set('x', 99);
    expect(cache.size()).toBe(2);
    expect(cache.get('x')).toBe(99);
    expect(cache.get('y')).toBe(20);
  });

  it('de-duplicates concurrent in-flight requests (getOrFetch)', async () => {
    const cache = new AICache();
    let fetchCount = 0;

    const slowFetcher = async () => {
      fetchCount++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { data: 'hello world' };
    };

    // Fire 3 simultaneous requests for the same key
    const [res1, res2, res3] = await Promise.all([
      cache.getOrFetch('same-key', slowFetcher),
      cache.getOrFetch('same-key', slowFetcher),
      cache.getOrFetch('same-key', slowFetcher),
    ]);

    expect(fetchCount).toBe(1);
    expect(res1.value).toEqual({ data: 'hello world' });
    expect(res2.value).toEqual({ data: 'hello world' });
    expect(res3.value).toEqual({ data: 'hello world' });

    // Subsequent call after resolved should hit the cache
    const res4 = await cache.getOrFetch('same-key', slowFetcher);
    expect(fetchCount).toBe(1);
    expect(res4.cached).toBe(true);
  });

  it('clears all entries and in-flight promises with clear()', () => {
    const cache = new AICache();
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    expect(cache.size()).toBe(2);

    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('k1')).toBeUndefined();
  });
});
