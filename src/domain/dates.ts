/**
 * Pure UTC date-only arithmetic helpers.
 *
 * Rules:
 * - Dates are ALWAYS represented as 'YYYY-MM-DD' strings.
 * - Math is strictly in UTC (zero local timezone drift, IST-safe, leap-year safe).
 * - NEVER calls Date.now() or new Date() with local time.
 */

const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

export function isValidDateString(str: unknown): str is string {
  if (typeof str !== 'string' || !DATE_REGEX.test(str)) {
    return false;
  }
  const parts = str.split('-').map(Number);
  const year = parts[0]!;
  const month = parts[1]!;
  const day = parts[2]!;

  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-').map(Number);
  return {
    year: parts[0] ?? 0,
    month: parts[1] ?? 1,
    day: parts[2] ?? 1,
  };
}

const MS_PER_DAY = 86_400_000;

/**
 * Returns number of calendar days between d1 and d2 (d2 - d1).
 * Positive if d2 is after d1, negative if d2 is before d1.
 */
export function daysBetween(d1: string, d2: string): number {
  const p1 = parseDateParts(d1);
  const p2 = parseDateParts(d2);
  const utc1 = Date.UTC(p1.year, p1.month - 1, p1.day);
  const utc2 = Date.UTC(p2.year, p2.month - 1, p2.day);
  return Math.round((utc2 - utc1) / MS_PER_DAY);
}

/**
 * Adds integer days (positive or negative) to a date string.
 * Handles month boundaries, year boundaries, and leap years accurately.
 */
export function addDays(dateStr: string, days: number): string {
  const p = parseDateParts(dateStr);
  const utc = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDateAfter(d1: string, d2: string): boolean {
  return daysBetween(d2, d1) > 0;
}

export function isDateBefore(d1: string, d2: string): boolean {
  return daysBetween(d2, d1) < 0;
}

export function isDateSameOrAfter(d1: string, d2: string): boolean {
  return daysBetween(d2, d1) >= 0;
}

export function getMonth1Based(dateStr: string): number {
  return parseDateParts(dateStr).month;
}
