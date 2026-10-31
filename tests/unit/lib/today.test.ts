import { describe, it, expect } from 'vitest';
import { getTodayInIst, getTomorrowInIst } from '@/lib/today';

describe('Client Today Reference (src/lib/today.ts)', () => {
  it('formats calendar date in Indian Standard Time (Asia/Kolkata)', () => {
    // 2026-10-29 19:00:00 UTC = 2026-10-30 00:30:00 IST (+5:30)
    const lateUtcDate = new Date('2026-10-29T19:00:00Z');
    const ist = getTodayInIst(lateUtcDate);
    expect(ist).toBe('2026-10-30');
  });

  it('correctly returns date before midnight IST transition', () => {
    // 2026-10-29 18:00:00 UTC = 2026-10-29 23:30:00 IST
    const beforeMidnightUtc = new Date('2026-10-29T18:00:00Z');
    const ist = getTodayInIst(beforeMidnightUtc);
    expect(ist).toBe('2026-10-29');
  });

  it('computes tomorrow in IST correctly crossing month boundary', () => {
    const endOfMonth = new Date('2026-10-31T06:00:00Z');
    const tomorrow = getTomorrowInIst(endOfMonth);
    expect(tomorrow).toBe('2026-11-01');
  });

  it('defaults to current runtime date with YYYY-MM-DD pattern', () => {
    const today = getTodayInIst();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const tomorrow = getTomorrowInIst();
    expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
