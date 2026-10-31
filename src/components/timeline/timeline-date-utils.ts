import { MilestoneItem } from '@/domain/rules/timeline';
import { addDays } from '@/domain/dates';

export interface CalendarLinkItem {
  milestoneId: string;
  title: string;
  date: string;
  critical: boolean;
  phase: 'before' | 'after';
  googleCalendarUrl: string;
}

// Formats YYYY-MM-DD into "Sat, 14 Nov 2026"
export function formatPrettyDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

// Formats Month Year for headers: "November 2026"
export function formatMonthHeader(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

export function buildClientGoogleCalendarUrl(milestone: MilestoneItem, eventType?: string): string {
  const cleanTitle = (milestone.title || '').replace(/[\r\n]+/g, ' ').trim();
  const eventName = eventType ? ` [${eventType}]` : '';
  const text = `${cleanTitle}${eventName}`;
  const cleanDetail = (milestone.detail || '').replace(/[\r\n]+/g, ' ').trim();
  const verifyNote = milestone.verifyNote
    ? ` Note: ${(milestone.verifyNote || '').replace(/[\r\n]+/g, ' ').trim()}`
    : '';
  const details = `${cleanDetail}${verifyNote} - Planned with Utsav Planner`;

  const startDate = milestone.date.replace(/-/g, '');
  const nextDay = addDays(milestone.date, 1);
  const endDate = nextDay.replace(/-/g, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates: `${startDate}/${endDate}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
