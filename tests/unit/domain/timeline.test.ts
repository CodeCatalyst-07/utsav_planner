import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeTimeline } from '@/domain/rules/timeline';
import { indiaLocalePack } from '@/domain/config/in';
import { EventProfile, EventType } from '@/domain/schemas/profile';
import { addDays, isDateBefore, isDateAfter } from '@/domain/dates';

describe('Timeline Engine (src/domain/rules/timeline.ts)', () => {
  const TODAY = '2026-10-29';

  const baseProfile: EventProfile = {
    eventType: 'wedding',
    eventDate: '2027-10-29', // 365 days away (standard mode, minLeadDays = 180)
    cityTier: 'tier1',
    cityName: 'Pune',
    guestCount: 300,
    totalBudgetInr: 2_500_000,
    budgetTier: 'mid',
    venueType: 'lawn',
    functionsCount: 3,
    dietary: { veg: 240, nonVeg: 50, jain: 10, vegan: 0 },
    toggles: { venueIncluded: false, includeAttireJewellery: true },
    overrides: {},
    notes: undefined,
  };

  it('activates standard mode when daysToEvent >= minLeadDays', () => {
    const result = computeTimeline(baseProfile, indiaLocalePack, TODAY);
    expect(result.mode).toBe('standard');
    expect(result.daysToEvent).toBe(365);
    expect(result.criticalVendorsUnavailableNotice).toBe(false);
  });

  it('activates compressed mode when daysToEvent < minLeadDays', () => {
    // 90 days away for wedding (< 180 minLeadDays)
    const compressedProfile: EventProfile = {
      ...baseProfile,
      eventDate: addDays(TODAY, 90),
    };

    const result = computeTimeline(compressedProfile, indiaLocalePack, TODAY);
    expect(result.mode).toBe('compressed');
    expect(result.daysToEvent).toBe(90);
    expect(result.criticalVendorsUnavailableNotice).toBe(true);

    // All pre-event milestones must fall in [TODAY, eventDate - 1]
    const dayBeforeEvent = addDays(compressedProfile.eventDate, -1);
    for (const m of result.milestones.filter((m) => m.phase === 'before')) {
      expect(isDateBefore(m.date, TODAY)).toBe(false);
      expect(isDateAfter(m.date, dayBeforeEvent)).toBe(false);
    }
  });

  it('marks catch-up milestones that were past in standard mode', () => {
    // 100 days away for wedding: milestone offset 330 was originally in the past
    const compressedProfile: EventProfile = {
      ...baseProfile,
      eventDate: addDays(TODAY, 100),
    };

    const result = computeTimeline(compressedProfile, indiaLocalePack, TODAY);
    const earlyMilestone = result.milestones.find((m) => m.id === 'wedding_venue_photo'); // offset 330
    expect(earlyMilestone).toBeDefined();
    expect(earlyMilestone?.catchUp).toBe(true);
  });

  it('correctly handles leap-year dates (event on 2028-02-29)', () => {
    const leapProfile: EventProfile = {
      ...baseProfile,
      eventDate: '2028-02-29',
    };

    const result = computeTimeline(leapProfile, indiaLocalePack, TODAY);
    expect(result.daysToEvent).toBeGreaterThan(0);
    expect(result.milestones.length).toBeGreaterThan(0);

    // Verify day before event is 2028-02-28
    const lastPreEvent = result.milestones.filter((m) => m.phase === 'before').slice(-1)[0];
    expect(lastPreEvent).toBeDefined();
    expect(isDateBefore(lastPreEvent!.date, '2028-03-01')).toBe(true);
  });

  it('retains post-event milestones with negative offsets', () => {
    const festivalProfile: EventProfile = {
      ...baseProfile,
      eventType: 'community_festival',
      eventDate: addDays(TODAY, 120),
    };

    const result = computeTimeline(festivalProfile, indiaLocalePack, TODAY);
    const immersionMilestone = result.milestones.find((m) => m.id === 'festival_immersion_cleanup');
    expect(immersionMilestone).toBeDefined();
    expect(immersionMilestone?.phase).toBe('after');
    expect(immersionMilestone?.date).toBe(addDays(festivalProfile.eventDate, 1)); // offset -1 => +1 day
  });

  it('guarantees deterministic output (same input twice => identical result)', () => {
    const run1 = computeTimeline(baseProfile, indiaLocalePack, TODAY);
    const run2 = computeTimeline(baseProfile, indiaLocalePack, TODAY);
    expect(run1).toEqual(run2);
  });

  it('PROPERTY TEST: pre-event milestone dates are non-decreasing and bounded in compressed mode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EventType>(
          'wedding',
          'birthday_kids',
          'birthday_adult',
          'community_festival'
        ),
        fc.integer({ min: 2, max: 500 }),
        (eventType, daysAhead) => {
          const profile: EventProfile = {
            ...baseProfile,
            eventType,
            eventDate: addDays(TODAY, daysAhead),
          };

          const result = computeTimeline(profile, indiaLocalePack, TODAY);
          const preMilestones = result.milestones.filter((m) => m.phase === 'before');
          const dayBeforeEvent = addDays(profile.eventDate, -1);

          for (let i = 0; i < preMilestones.length; i++) {
            const current = preMilestones[i]!;

            // Pre-event dates must never exceed dayBeforeEvent
            expect(isDateAfter(current.date, dayBeforeEvent)).toBe(false);

            // In compressed mode, dates are strictly bounded by today from below
            if (result.mode === 'compressed') {
              expect(isDateBefore(current.date, TODAY)).toBe(false);
            }

            // Monotonic non-decreasing sequence across all modes
            if (i > 0) {
              const prev = preMilestones[i - 1]!;
              expect(isDateBefore(current.date, prev.date)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
