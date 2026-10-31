/**
 * src/lib/today.ts
 *
 * Client-safe date reference in Indian Standard Time (IST, Asia/Kolkata).
 * Pure browser/client utility. NEVER imports from src/server/.
 */

import { addDays } from '@/domain/dates';

/**
 * Returns the current calendar date in Indian Standard Time (IST, UTC+5:30) as YYYY-MM-DD.
 * Ensures consistent Indian date calculation regardless of user browser time zone.
 */
export function getTodayInIst(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Returns tomorrow's calendar date in IST as YYYY-MM-DD.
 * Used for setting min attribute on wizard date picker.
 */
export function getTomorrowInIst(now: Date = new Date()): string {
  const today = getTodayInIst(now);
  return addDays(today, 1);
}
