import { describe, it, expect } from 'vitest';
import {
  fnv1aHash,
  sha256Hex,
  buildIdeasCacheKey,
  buildMenuCacheKey,
  buildCategoryTipsCacheKey,
} from '@/lib/hash';

describe('Deterministic Hashing (src/lib/hash.ts)', () => {
  it('computes 8-character hex hash consistently', () => {
    const h1 = fnv1aHash('wedding:pune:200:mid');
    const h2 = fnv1aHash('wedding:pune:200:mid');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('produces distinct hashes for different inputs', () => {
    const h1 = fnv1aHash('wedding');
    const h2 = fnv1aHash('birthday');
    expect(h1).not.toBe(h2);
  });

  it('computes sha256 hex string using web crypto or fallback', async () => {
    const h1 = await sha256Hex('test payload');
    const h2 = await sha256Hex('test payload');
    expect(h1).toBe(h2);
    expect(typeof h1).toBe('string');
  });

  it('buildIdeasCacheKey never exposes raw personal notes', () => {
    const key = buildIdeasCacheKey({
      eventType: 'wedding',
      cityName: 'Pune',
      guestCount: 200,
      budgetTier: 'mid',
      notes: 'Secret phone: 9876543210 and private address',
    });

    expect(key).toMatch(/^utsav_ideas_[0-9a-f]{8}$/);
    expect(key).not.toContain('9876543210');
    expect(key).not.toContain('private');
  });

  it('buildMenuCacheKey produces deterministic hash key', () => {
    const key1 = buildMenuCacheKey({
      eventType: 'wedding',
      dietary: { veg: 100, nonVeg: 50, jain: 10, vegan: 5 },
      guestCount: 165,
    });
    const key2 = buildMenuCacheKey({
      eventType: 'wedding',
      dietary: { veg: 100, nonVeg: 50, jain: 10, vegan: 5 },
      guestCount: 165,
    });
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^utsav_menu_[0-9a-f]{8}$/);
  });

  it('buildCategoryTipsCacheKey produces deterministic hash key', () => {
    const key1 = buildCategoryTipsCacheKey({
      eventType: 'wedding',
      cityName: 'Pune',
      totalBudgetInr: 4000000,
      guestCount: 200,
    });
    const key2 = buildCategoryTipsCacheKey({
      eventType: 'wedding',
      cityName: 'Pune',
      totalBudgetInr: 4000000,
      guestCount: 200,
    });
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^utsav_tips_[0-9a-f]{8}$/);
  });

  it('generates identical cache keys for case-insensitive city and trimmed notes', () => {
    const key1 = buildIdeasCacheKey({
      eventType: 'wedding',
      cityName: 'Pune',
      guestCount: 200,
      budgetTier: 'mid',
      notes: 'Pastel themes ',
    });

    const key2 = buildIdeasCacheKey({
      eventType: 'wedding',
      cityName: 'pune',
      guestCount: 200,
      budgetTier: 'mid',
      notes: 'pastel themes',
    });

    expect(key1).toBe(key2);
  });
});
