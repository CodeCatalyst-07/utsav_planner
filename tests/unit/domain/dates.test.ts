import { describe, it, expect } from 'vitest';
import {
  isValidDateString,
  parseDateParts,
  daysBetween,
  addDays,
  isDateAfter,
  isDateBefore,
  isDateSameOrAfter,
  getMonth1Based,
} from '@/domain/dates';

describe('Date Utilities (src/domain/dates.ts)', () => {
  it('validates date strings strictly', () => {
    expect(isValidDateString('2026-10-29')).toBe(true);
    expect(isValidDateString('2028-02-29')).toBe(true); // Leap year valid
    expect(isValidDateString('2027-02-29')).toBe(false); // Non-leap year invalid
    expect(isValidDateString('2026-13-01')).toBe(false); // Month 13 invalid
    expect(isValidDateString('invalid')).toBe(false);
    expect(isValidDateString(null)).toBe(false);
  });

  it('parses date parts accurately', () => {
    expect(parseDateParts('2026-10-29')).toEqual({ year: 2026, month: 10, day: 29 });
  });

  it('computes daysBetween without timezone drift', () => {
    expect(daysBetween('2026-10-29', '2026-10-30')).toBe(1);
    expect(daysBetween('2026-10-30', '2026-10-29')).toBe(-1);
    expect(daysBetween('2026-10-29', '2026-10-29')).toBe(0);
    expect(daysBetween('2026-10-29', '2027-10-29')).toBe(365);
  });

  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-10-29', 3)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // Leap year
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('compares dates accurately', () => {
    expect(isDateAfter('2026-10-30', '2026-10-29')).toBe(true);
    expect(isDateAfter('2026-10-29', '2026-10-30')).toBe(false);
    expect(isDateBefore('2026-10-29', '2026-10-30')).toBe(true);
    expect(isDateSameOrAfter('2026-10-29', '2026-10-29')).toBe(true);
    expect(isDateSameOrAfter('2026-10-30', '2026-10-29')).toBe(true);
  });

  it('gets 1-based month', () => {
    expect(getMonth1Based('2026-01-15')).toBe(1);
    expect(getMonth1Based('2026-12-25')).toBe(12);
  });
});
