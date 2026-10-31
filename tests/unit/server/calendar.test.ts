import { describe, it, expect } from 'vitest';
import {
  googleCalendarUrl,
  googleCalendarCatchUpUrl,
  buildIcs,
  foldIcsLine,
  escapeIcsValue,
  sanitizeIcsText,
  formatIcsDate,
} from '@/server/google/calendar';
import { MilestoneItem } from '@/domain/rules/timeline';
import { buildPlan } from '@/domain/rules/plan';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';
import { indiaLocalePack } from '@/domain/config/in';

describe('Google Calendar Helpers & RFC 5545 ICS (src/server/google/calendar.ts)', () => {
  const sampleMilestone: MilestoneItem = {
    id: 'wedding_catering_tasting',
    title: 'Food Tasting & Menu Finalization',
    detail: 'Schedule final menu tasting, clarify live chaat counters and Jain food prep.',
    date: '2027-02-14',
    daysBeforeEvent: 0,
    standardOffsetDays: 60,
    critical: true,
    verifyNote: 'Confirm allergen counters',
    phase: 'before',
  };

  describe('googleCalendarUrl (No-OAuth Template URLs)', () => {
    it('generates valid Google Calendar URL with exclusive DTEND (+1 day) and encoding', () => {
      const url = googleCalendarUrl(sampleMilestone, weddingPuneFixture);
      expect(url).toContain('https://calendar.google.com/calendar/render?');
      expect(url).toContain('action=TEMPLATE');
      // 2027-02-14 start, 2027-02-15 exclusive end
      expect(url).toContain('dates=20270214%2F20270215');
      expect(url).toContain('text=Food+Tasting');
      expect(url).toContain('details=Schedule+final+menu+tasting');
      expect(url).toContain('Confirm+allergen+counters');
    });

    it('correctly handles leap day milestone (2028-02-29 -> exclusive end 2028-03-01)', () => {
      const leapMilestone: MilestoneItem = {
        ...sampleMilestone,
        date: '2028-02-29',
      };
      const url = googleCalendarUrl(leapMilestone);
      expect(url).toContain('dates=20280229%2F20280301');
    });

    it('properly encodes special characters in title and notes', () => {
      const specialMilestone: MilestoneItem = {
        ...sampleMilestone,
        title: 'Mehendi & Sangeet: "Dhol" & DJ',
        detail: 'Cost ₹10,000 & 50% advance; verify terms.',
      };
      const url = googleCalendarUrl(specialMilestone);
      expect(url).not.toContain('₹');
      expect(url).toContain('Mehendi+%26+Sangeet%3A+%22Dhol%22+%26+DJ');
    });
  });

  describe('buildIcs (RFC 5545 Compliant Generator)', () => {
    const plan = buildPlan(weddingPuneFixture, '2026-10-29', indiaLocalePack);

    it('generates RFC 5545 document with strict CRLF line endings', () => {
      const ics = buildIcs(plan, weddingPuneFixture);

      expect(ics).toContain('BEGIN:VCALENDAR\r\n');
      expect(ics).toContain('VERSION:2.0\r\n');
      expect(ics).toContain('PRODID:-//Utsav Planner//IN\r\n');
      expect(ics).toContain('END:VCALENDAR\r\n');

      // Every line must end in CRLF, no standalone LF
      const lines = ics.split('\r\n');
      expect(lines.length).toBeGreaterThan(10);
      for (let i = 0; i < lines.length - 1; i++) {
        expect(lines[i]).not.toContain('\n');
        expect(lines[i]).not.toContain('\r');
      }
    });

    it('includes all-day DATE events with exclusive DTEND', () => {
      const ics = buildIcs(plan, weddingPuneFixture);

      expect(ics).toContain('DTSTART;VALUE=DATE:');
      expect(ics).toContain('DTEND;VALUE=DATE:');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('END:VEVENT');
    });

    it('adds VALARM display reminder 1 day before for critical milestones', () => {
      const ics = buildIcs(plan, weddingPuneFixture);

      expect(ics).toContain('BEGIN:VALARM\r\n');
      expect(ics).toContain('ACTION:DISPLAY\r\n');
      expect(ics).toContain('TRIGGER:-P1D\r\n');
      expect(ics).toContain('END:VALARM\r\n');
    });

    it('strips raw CR and LF from user inputs to prevent ICS structure injection', () => {
      const injectedMilestone: MilestoneItem = {
        id: 'injected_test',
        title: 'Title\r\nINJECTED:HEADER\nANOTHER:INJECTION',
        detail: 'Line 1\r\nLine 2',
        date: '2027-02-14',
        daysBeforeEvent: 0,
        standardOffsetDays: 30,
        critical: false,
        phase: 'before',
      };

      const customPlan = {
        ...plan,
        timeline: {
          ...plan.timeline,
          milestones: [injectedMilestone],
        },
      };

      const ics = buildIcs(customPlan, weddingPuneFixture);

      // Verify that CRLF injection attempts did not create new standalone ICS properties
      expect(ics).not.toContain('\r\nINJECTED:HEADER');
      expect(ics).not.toContain('\r\nANOTHER:INJECTION');
      expect(ics).toContain('SUMMARY:Title INJECTED:HEADER ANOTHER:INJECTION');
    });

    it('escapes commas, semicolons, and backslashes in text properties', () => {
      expect(escapeIcsValue('Hello, World; Testing \\ Backslash')).toBe(
        'Hello\\, World\\; Testing \\\\ Backslash'
      );
    });

    it('folds lines exceeding 75 octets with CRLF followed by single space', () => {
      const longText =
        'DESCRIPTION:This is a very long descriptive text that easily exceeds seventy-five octets in length and must be folded properly by RFC 5545 rules.';
      const folded = foldIcsLine(longText);

      expect(folded).toContain('\r\n ');
      const subLines = folded.split('\r\n');
      expect(Buffer.byteLength(subLines[0]!, 'utf-8')).toBeLessThanOrEqual(75);
      expect(Buffer.byteLength(subLines[1]!, 'utf-8')).toBeLessThanOrEqual(75);
      expect(subLines[1]!.startsWith(' ')).toBe(true);
    });

    it('formats dates consistently as YYYYMMDD', () => {
      expect(formatIcsDate('2027-02-14')).toBe('20270214');
      expect(formatIcsDate('2028-12-31')).toBe('20281231');
    });

    it('aggregates caught-up milestones into ONE all-day event today listing them in the description', () => {
      const caughtUpPlan = {
        ...plan,
        timeline: {
          ...plan.timeline,
          milestones: [
            {
              id: 'task_1',
              title: 'Book Venue',
              detail: 'Lock primary lawn',
              date: '2026-10-29',
              daysBeforeEvent: 240,
              standardOffsetDays: 300,
              critical: true,
              phase: 'before' as const,
              catchUp: true,
            },
            {
              id: 'task_2',
              title: 'Priest Muhurat',
              detail: 'Confirm auspicious hours',
              date: '2026-10-29',
              daysBeforeEvent: 240,
              standardOffsetDays: 280,
              critical: false,
              phase: 'before' as const,
              catchUp: true,
            },
            {
              id: 'task_3',
              title: 'Order Cake',
              detail: 'Select bakery',
              date: '2026-12-01',
              daysBeforeEvent: 207,
              standardOffsetDays: 207,
              critical: false,
              phase: 'before' as const,
              catchUp: false,
            },
          ],
        },
      };

      const ics = buildIcs(caughtUpPlan, weddingPuneFixture);

      // Verify ONE catch-up event
      expect(ics).toContain('SUMMARY:Catch-up: 2 planning tasks to start now');
      expect(ics).toContain('1. Book Venue [Critical]: Lock primary lawn');
      expect(ics).toContain('Priest Muhurat:');

      // Verify normal milestone has its own event
      expect(ics).toContain('SUMMARY:Order Cake');

      // Count VEVENT occurrences: exactly 2 events (1 catch-up + 1 normal)
      const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
      expect(veventCount).toBe(2);
    });

    it('generates googleCalendarCatchUpUrl aggregating caught-up milestones', () => {
      const caughtUpItems: MilestoneItem[] = [
        {
          id: 'task_1',
          title: 'Book Venue',
          detail: 'Lock primary lawn',
          date: '2026-10-29',
          daysBeforeEvent: 240,
          standardOffsetDays: 300,
          critical: true,
          phase: 'before',
          catchUp: true,
        },
        {
          id: 'task_2',
          title: 'Priest Muhurat',
          detail: 'Confirm hours',
          date: '2026-10-29',
          daysBeforeEvent: 240,
          standardOffsetDays: 280,
          critical: false,
          phase: 'before',
          catchUp: true,
        },
      ];

      const url = googleCalendarCatchUpUrl(caughtUpItems, weddingPuneFixture);
      expect(url).toContain('Catch-up%3A+2+planning+tasks+to+start+now');
      expect(url).toContain('1.+Book+Venue+%5BCritical%5D%3A+Lock+primary+lawn');
      expect(url).toContain('dates=20261029%2F20261030');
    });
  });
});
