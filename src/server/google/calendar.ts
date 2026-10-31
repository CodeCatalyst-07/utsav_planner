import 'server-only';
import { MilestoneItem } from '@/domain/rules/timeline';
import { EventPlan } from '@/domain/rules/plan';
import { EventProfile } from '@/domain/schemas/profile';
import { addDays } from '@/domain/dates';

/**
 * Strips raw carriage return and newline characters to prevent ICS stream / header injection.
 */
export function sanitizeIcsText(input?: string): string {
  if (!input) return '';
  return input.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Escapes special RFC 5545 characters in text properties:
 * Backslash -> \\, Semicolon -> \;, Comma -> \,, Newline -> \n
 */
export function escapeIcsValue(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

/**
 * Formats YYYY-MM-DD into RFC 5545 DATE value YYYYMMDD.
 */
export function formatIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/**
 * RFC 5545 Line Folding:
 * Lines of text SHOULD NOT be longer than 75 octets, excluding the line break.
 * Long lines are folded by inserting CRLF followed by a single space character.
 */
export function foldIcsLine(line: string): string {
  const lineBuffer = Buffer.from(line, 'utf-8');
  if (lineBuffer.length <= 75) {
    return line;
  }

  let result = '';
  let currentBytes = 0;
  let isFirstLine = true;

  for (const char of line) {
    const charBytes = Buffer.byteLength(char, 'utf-8');
    const limit = isFirstLine ? 75 : 74; // Account for the leading space on folded lines

    if (currentBytes + charBytes > limit) {
      result += '\r\n ' + char;
      currentBytes = 1 + charBytes;
      isFirstLine = false;
    } else {
      result += char;
      currentBytes += charBytes;
    }
  }

  return result;
}

/**
 * Generates a zero-OAuth Google Calendar web template URL for an individual milestone.
 * All-day event with exclusive DTEND (+1 day).
 * Format: https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=YYYYMMDD/YYYYMMDD&details=...
 */
export function googleCalendarUrl(milestone: MilestoneItem, profile?: EventProfile): string {
  const cleanTitle = sanitizeIcsText(milestone.title);
  const eventName = profile?.eventType ? ` [${profile.eventType}]` : '';
  const text = `${cleanTitle}${eventName}`;

  const cleanDetail = sanitizeIcsText(milestone.detail);
  const verifyNote = milestone.verifyNote ? ` Note: ${sanitizeIcsText(milestone.verifyNote)}` : '';
  const details = `${cleanDetail}${verifyNote} - Planned with Utsav Planner`;

  const startDate = formatIcsDate(milestone.date);
  const nextDay = addDays(milestone.date, 1);
  const endDate = formatIcsDate(nextDay);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates: `${startDate}/${endDate}`,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates a zero-OAuth Google Calendar web template URL aggregating all caught-up milestones on today.
 */
export function googleCalendarCatchUpUrl(
  caughtUp: MilestoneItem[],
  profile?: EventProfile
): string {
  const count = caughtUp.length;
  const eventName = profile?.eventType ? ` [${profile.eventType}]` : '';
  const text = `Catch-up: ${count} planning tasks to start now${eventName}`;
  const catchUpDate = caughtUp[0]?.date || '2026-10-29';
  const startDate = formatIcsDate(catchUpDate);
  const nextDay = addDays(catchUpDate, 1);
  const endDate = formatIcsDate(nextDay);

  const taskDescriptions = caughtUp.map((m, i) => {
    const title = sanitizeIcsText(m.title);
    const detail = sanitizeIcsText(m.detail);
    const note = m.verifyNote ? ` (${sanitizeIcsText(m.verifyNote)})` : '';
    return `${i + 1}. ${title}${m.critical ? ' [Critical]' : ''}: ${detail}${note}`;
  });
  const details = `${taskDescriptions.join('\n')} - Planned with Utsav Planner`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates: `${startDate}/${endDate}`,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates a full RFC 5545 compliant .ics calendar file for the entire event timeline.
 * Strict CRLF line endings, 75-octet folding, stable UIDs, and VALARM reminders on critical milestones.
 * Aggregates all caught-up items on today into ONE all-day event.
 */
export function buildIcs(plan: EventPlan, profile?: EventProfile): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Utsav Planner//IN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  // Deterministic DTSTAMP based on reference today date
  const dtstamp = `${formatIcsDate(plan.timeline.milestones[0]?.date || '20261029')}T000000Z`;
  const eventTypeTag = profile?.eventType || 'event';

  const caughtUp = plan.timeline.milestones.filter((m) => m.catchUp);
  const normal = plan.timeline.milestones.filter((m) => !m.catchUp);

  if (caughtUp.length > 0) {
    const catchUpDate = caughtUp[0]!.date;
    const startDate = formatIcsDate(catchUpDate);
    const endDate = formatIcsDate(addDays(catchUpDate, 1));
    const uid = `${eventTypeTag}-catchup-${startDate}@utsavplanner.app`;
    const summary = escapeIcsValue(`Catch-up: ${caughtUp.length} planning tasks to start now`);

    const taskLines = caughtUp.map((m, i) => {
      const cleanTitle = sanitizeIcsText(m.title);
      const cleanDetail = sanitizeIcsText(m.detail);
      const cleanNote = m.verifyNote ? ` (${sanitizeIcsText(m.verifyNote)})` : '';
      return `${i + 1}. ${cleanTitle}${m.critical ? ' [Critical]' : ''}: ${cleanDetail}${cleanNote}`;
    });
    const description = escapeIcsValue(taskLines.join('\n')).replace(/\n/g, '\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);

    if (caughtUp.some((m) => m.critical)) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Reminder: Critical Catch-up Tasks Due');
      lines.push('TRIGGER:-P0D');
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  for (const m of normal) {
    const cleanTitle = escapeIcsValue(sanitizeIcsText(m.title));
    const cleanDetail = escapeIcsValue(sanitizeIcsText(m.detail));
    const cleanNote = m.verifyNote ? ` (${escapeIcsValue(sanitizeIcsText(m.verifyNote))})` : '';
    const description = `${cleanDetail}${cleanNote}`;

    const startDate = formatIcsDate(m.date);
    const endDate = formatIcsDate(addDays(m.date, 1));
    const uid = `${eventTypeTag}-${m.id}-${startDate}@utsavplanner.app`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
    lines.push(`SUMMARY:${cleanTitle}`);
    lines.push(`DESCRIPTION:${description}`);

    if (m.critical) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Reminder: Critical Milestone Due');
      lines.push('TRIGGER:-P1D');
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // Fold long lines and join with strict CRLF line endings
  return lines.map((line) => foldIcsLine(line)).join('\r\n') + '\r\n';
}
