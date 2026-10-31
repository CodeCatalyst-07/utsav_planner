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

  it('PROPERTY TEST: pre-event milestones across 1..700 days ahead are >= today, <= eventDate, non-decreasing, and catchUp matches standard date < today', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EventType>(
          'wedding',
          'birthday_kids',
          'birthday_adult',
          'community_festival'
        ),
        fc.integer({ min: 1, max: 700 }),
        (eventType, daysAhead) => {
          const profile: EventProfile = {
            ...baseProfile,
            eventType,
            eventDate: addDays(TODAY, daysAhead),
          };

          const result = computeTimeline(profile, indiaLocalePack, TODAY);
          const preMilestones = result.milestones.filter((m) => m.phase === 'before');

          const rawDefs = indiaLocalePack.milestones[eventType] ?? [];
          const defMap = new Map(rawDefs.map((d) => [d.id, d.offset]));

          for (let i = 0; i < preMilestones.length; i++) {
            const current = preMilestones[i]!;

            // 1. All pre-event dates >= today
            expect(isDateBefore(current.date, TODAY)).toBe(false);

            // 2. All pre-event dates <= eventDate
            expect(isDateAfter(current.date, profile.eventDate)).toBe(false);

            // 3. Monotonic non-decreasing sequence across all modes
            if (i > 0) {
              const prev = preMilestones[i - 1]!;
              expect(isDateBefore(current.date, prev.date)).toBe(false);
            }

            // 4. catchUp true exactly for items whose standard date would be < today
            const originalOffset = defMap.get(current.id) ?? 0;
            const standardDate = addDays(profile.eventDate, -originalOffset);
            const expectedCatchUp = isDateBefore(standardDate, TODAY);
            expect(current.catchUp).toBe(expectedCatchUp);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('sample wedding at +360 days has zero past dates, sets standardOffsetDays, and properly tags the first 2 milestones as catch-up', () => {
    const wedding360: EventProfile = {
      ...baseProfile,
      eventType: 'wedding',
      eventDate: addDays(TODAY, 360),
    };

    const result = computeTimeline(wedding360, indiaLocalePack, TODAY);
    expect(result.mode).toBe('standard'); // 360 >= minLeadDays (180)
    expect(result.daysToEvent).toBe(360);

    // Verify ZERO past dates across all milestones and valid standardOffsetDays
    for (const m of result.milestones) {
      expect(isDateBefore(m.date, TODAY)).toBe(false);
      expect(typeof m.standardOffsetDays).toBe('number');
    }

    const preMilestones = result.milestones.filter((m) => m.phase === 'before');
    expect(preMilestones.length).toBeGreaterThanOrEqual(6);

    // 1. wedding_budget (offset 420): standard was TODAY - 60 (past) -> date = TODAY, catchUp = true, standardOffsetDays = 420
    expect(preMilestones[0]!.id).toBe('wedding_budget');
    expect(preMilestones[0]!.date).toBe(TODAY);
    expect(preMilestones[0]!.catchUp).toBe(true);
    expect(preMilestones[0]!.standardOffsetDays).toBe(420);

    // 2. wedding_muhurat (offset 400): standard was TODAY - 40 (past) -> date = TODAY, catchUp = true, standardOffsetDays = 400
    expect(preMilestones[1]!.id).toBe('wedding_muhurat');
    expect(preMilestones[1]!.date).toBe(TODAY);
    expect(preMilestones[1]!.catchUp).toBe(true);
    expect(preMilestones[1]!.standardOffsetDays).toBe(400);

    // 3. wedding_venue_photo (offset 330): standard is TODAY + 30 (future) -> date = 2026-11-28, catchUp = false, standardOffsetDays = 330
    expect(preMilestones[2]!.id).toBe('wedding_venue_photo');
    expect(preMilestones[2]!.date).toBe(addDays(TODAY, 30));
    expect(preMilestones[2]!.catchUp).toBe(false);
    expect(preMilestones[2]!.standardOffsetDays).toBe(330);
  });

  it('sample wedding at +240 days has zero past dates and properly tags the first 5 milestones as catch-up', () => {
    const wedding240: EventProfile = {
      ...baseProfile,
      eventType: 'wedding',
      eventDate: addDays(TODAY, 240),
    };

    const result = computeTimeline(wedding240, indiaLocalePack, TODAY);
    expect(result.mode).toBe('standard'); // 240 >= minLeadDays (180)
    expect(result.daysToEvent).toBe(240);

    // Verify ZERO past dates across all milestones
    for (const m of result.milestones) {
      expect(isDateBefore(m.date, TODAY)).toBe(false);
    }

    const preMilestones = result.milestones.filter((m) => m.phase === 'before');
    expect(preMilestones.length).toBeGreaterThanOrEqual(6);

    // First 6 milestones comparison:
    // 1. wedding_budget (offset 420): standard was TODAY - 180 (past) -> date = TODAY, catchUp = true
    expect(preMilestones[0]!.id).toBe('wedding_budget');
    expect(preMilestones[0]!.date).toBe(TODAY);
    expect(preMilestones[0]!.catchUp).toBe(true);

    // 2. wedding_muhurat (offset 400): standard was TODAY - 160 (past) -> date = TODAY, catchUp = true
    expect(preMilestones[1]!.id).toBe('wedding_muhurat');
    expect(preMilestones[1]!.date).toBe(TODAY);
    expect(preMilestones[1]!.catchUp).toBe(true);

    // 3. wedding_venue_photo (offset 330): standard was TODAY - 90 (past) -> date = TODAY, catchUp = true
    expect(preMilestones[2]!.id).toBe('wedding_venue_photo');
    expect(preMilestones[2]!.date).toBe(TODAY);
    expect(preMilestones[2]!.catchUp).toBe(true);

    // 4. wedding_planner_dest (offset 300): standard was TODAY - 60 (past) -> date = TODAY, catchUp = true
    expect(preMilestones[3]!.id).toBe('wedding_planner_dest');
    expect(preMilestones[3]!.date).toBe(TODAY);
    expect(preMilestones[3]!.catchUp).toBe(true);

    // 5. wedding_caterer_decor (offset 270): standard was TODAY - 30 (past) -> date = TODAY, catchUp = true
    expect(preMilestones[4]!.id).toBe('wedding_caterer_decor');
    expect(preMilestones[4]!.date).toBe(TODAY);
    expect(preMilestones[4]!.catchUp).toBe(true);

    // 6. wedding_outfits_blocks (offset 180): standard is TODAY + 60 (future) -> date = 2026-12-28, catchUp = false
    expect(preMilestones[5]!.id).toBe('wedding_outfits_blocks');
    expect(preMilestones[5]!.date).toBe(addDays(TODAY, 60)); // '2026-12-28'
    expect(preMilestones[5]!.catchUp).toBe(false);
  });

  it('enforces monotonic invariant (lines 99-101) by clamping to previousDate when milestone offsets collapse or invert', () => {
    let call = 0;
    const dynamicOffset = {
      valueOf() {
        call++;
        // Calls during filter/sort return 200 so m1 is sorted between m0 (300) and m2 (100)
        // In loop execution, returns 1 so m1 computes an advanced date (dayBeforeEvent), forcing m2 to trigger monotonic clamp
        return call <= 3 ? 200 : 1;
      },
    };

    const customPack = {
      ...indiaLocalePack,
      milestones: {
        ...indiaLocalePack.milestones,
        wedding: [
          {
            id: 'm0_fixed',
            title: 'Early Milestone',
            detail: 'Offset 300',
            offset: 300,
            category: 'venue',
            critical: true,
            source: 'assumption' as const,
          },
          {
            id: 'm1_dynamic',
            title: 'Dynamic Milestone',
            detail: 'Offset dynamic',
            offset: dynamicOffset as any,
            category: 'venue',
            critical: false,
            source: 'assumption' as const,
          },
          {
            id: 'm2_fixed',
            title: 'Fixed Milestone',
            detail: 'Offset 100',
            offset: 100,
            category: 'venue',
            critical: false,
            source: 'assumption' as const,
          },
        ],
      },
    };

    const compressedProfile: EventProfile = {
      ...baseProfile,
      eventDate: addDays(TODAY, 60), // compressed mode
    };

    const result = computeTimeline(compressedProfile, customPack, TODAY);
    expect(result.milestones.length).toBe(3);
    // Milestone 2's date must be clamped to milestone 1's date (non-decreasing sequence)
    expect(result.milestones[2]!.date).toBe(result.milestones[1]!.date);
  });

  it('enforces invariant that pre-event milestones are never earlier than today (lines 95-96)', () => {
    const customPack = {
      ...indiaLocalePack,
      milestones: {
        ...indiaLocalePack.milestones,
        wedding: [
          {
            id: 'm_same_day',
            title: 'Urgent task',
            detail: 'Detail',
            offset: 10,
            category: 'venue',
            critical: true,
            source: 'assumption' as const,
          },
        ],
      },
    };

    // Event date in the past
    const pastProfile: EventProfile = {
      ...baseProfile,
      eventDate: addDays(TODAY, -5),
    };

    const result = computeTimeline(pastProfile, customPack, TODAY);
    expect(result.milestones[0]!.date).toBe(TODAY);
  });
});
