import 'server-only';

/**
 * Returns today's calendar date in Indian Standard Time (IST, UTC+5:30) as YYYY-MM-DD.
 * Server-side helper to ensure serverless executions in any cloud region produce the
 * correct Indian planning reference date.
 * Dependency injection: accepts `now: Date` (default: new Date()) for testing.
 */
export function todayInIst(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}
