import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatInr, inrSpoken, allocateLargestRemainder } from '@/domain/money/inr';

describe('Integer Rupee Money Utilities (src/domain/money/inr.ts)', () => {
  describe('formatInr', () => {
    it('formats zero and small numbers correctly', () => {
      expect(formatInr(0)).toBe('₹0');
      expect(formatInr(50)).toBe('₹50');
      expect(formatInr(999)).toBe('₹999');
      expect(formatInr(1000)).toBe('₹1,000');
    });

    it('formats numbers with standard Indian grouping (crores, lakhs, thousands)', () => {
      expect(formatInr(10_000)).toBe('₹10,000');
      expect(formatInr(60_000)).toBe('₹60,000');
      expect(formatInr(100_000)).toBe('₹1,00,000');
      expect(formatInr(1_234_567)).toBe('₹12,34,567');
      expect(formatInr(2_500_000)).toBe('₹25,00,000');
      expect(formatInr(500_000_000)).toBe('₹50,00,00,000');
    });

    it('handles negative integers cleanly', () => {
      expect(formatInr(-50000)).toBe('-₹50,000');
      expect(formatInr(-1234567)).toBe('-₹12,34,567');
    });
  });

  describe('inrSpoken', () => {
    it('converts amounts to natural Indian English speech for screen readers', () => {
      expect(inrSpoken(0)).toBe('zero rupees');
      expect(inrSpoken(60_000)).toBe('rupees 60 thousand');
      expect(inrSpoken(800_000)).toBe('rupees 8 lakh');
      expect(inrSpoken(25_000_000)).toBe('rupees 2 crore 50 lakh');
      expect(inrSpoken(1_234_567)).toBe('rupees 12 lakh 34 thousand 567');
    });

    it('handles negative numbers', () => {
      expect(inrSpoken(-50_000)).toBe('minus rupees 50 thousand');
    });
  });

  describe('allocateLargestRemainder', () => {
    it('handles edge cases: zero total, empty weights, zero weights', () => {
      expect(allocateLargestRemainder(0, [20, 30, 50])).toEqual([0, 0, 0]);
      expect(allocateLargestRemainder(1000, [])).toEqual([]);
      expect(allocateLargestRemainder(1000, [0, 0, 0])).toEqual([334, 333, 333]); // even distribution
    });

    it('allocates classic examples without remainder loss', () => {
      // 100 split 3 ways evenly: 33.33 each => deficit of 1 distributed to first index
      expect(allocateLargestRemainder(100, [1, 1, 1])).toEqual([34, 33, 33]);
      expect(allocateLargestRemainder(1000, [25, 25, 25, 25])).toEqual([250, 250, 250, 250]);
    });

    it('breaks ties deterministically by lower index', () => {
      // 10 distributed across [1, 1, 1] => 3.33 each, remainders equal 0.33 => first gets 4
      const result = allocateLargestRemainder(10, [1, 1, 1]);
      expect(result).toEqual([4, 3, 3]);
      expect(result.reduce((a, b) => a + b, 0)).toBe(10);
    });

    it('PROPERTY TEST: sum(allocated) === total exactly over arbitrary totals and weights', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500_000_000 }),
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
          (total, weights) => {
            const allocated = allocateLargestRemainder(total, weights);

            // Invariant 1: exact length
            expect(allocated.length).toBe(weights.length);

            // Invariant 2: every item is non-negative integer
            for (const val of allocated) {
              expect(Number.isInteger(val)).toBe(true);
              expect(val).toBeGreaterThanOrEqual(0);
            }

            // Invariant 3: sum matches total exactly
            const sum = allocated.reduce((acc, v) => acc + v, 0);
            expect(sum).toBe(total);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
