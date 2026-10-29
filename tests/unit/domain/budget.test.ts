import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeBudget } from '@/domain/rules/budget';
import { indiaLocalePack } from '@/domain/config/in';
import { EventProfile, EventType } from '@/domain/schemas/profile';

describe('Budget Engine (src/domain/rules/budget.ts)', () => {
  const baseProfile: EventProfile = {
    eventType: 'wedding',
    eventDate: '2027-02-14',
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

  it('verifies all locale pack budget splits sum to exactly 100%', () => {
    const eventTypes: EventType[] = [
      'wedding',
      'birthday_kids',
      'birthday_adult',
      'community_festival',
    ];

    for (const type of eventTypes) {
      const split = indiaLocalePack.budgetSplits[type];
      expect(split).toBeDefined();
      const sum = split.reduce((acc, cat) => acc + cat.weight, 0);
      expect(sum).toBe(100);
    }
  });

  it('allocates budget lines summing exactly to total with zero unallocated', () => {
    const result = computeBudget(baseProfile, indiaLocalePack);

    const sumLines = result.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(baseProfile.totalBudgetInr);
    expect(result.unallocated).toBe(0);
    expect(result.invariants.sumEqualsTotal).toBe(true);
    expect(result.invariants.noNegativeLines).toBe(true);
  });

  it('handles venueIncluded toggle by setting venue line to 0 and redistributing remainder', () => {
    const profileWithFreeVenue: EventProfile = {
      ...baseProfile,
      toggles: { venueIncluded: true, includeAttireJewellery: true },
    };

    const result = computeBudget(profileWithFreeVenue, indiaLocalePack);
    const venueLine = result.lines.find((l) => l.id === 'venue');
    expect(venueLine).toBeDefined();
    expect(venueLine?.amount).toBe(0);
    expect(venueLine?.percent).toBe(0);
    expect(venueLine?.source).toBe('derived');

    // Total must still equal exactly
    const sumLines = result.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(baseProfile.totalBudgetInr);
  });

  it('handles includeAttireJewellery=false for wedding by zeroing attire line', () => {
    const profileNoAttire: EventProfile = {
      ...baseProfile,
      toggles: { venueIncluded: false, includeAttireJewellery: false },
    };

    const result = computeBudget(profileNoAttire, indiaLocalePack);
    const attireLine = result.lines.find((l) => l.id === 'attire_jewellery');
    expect(attireLine).toBeDefined();
    expect(attireLine?.amount).toBe(0);
    expect(attireLine?.source).toBe('derived');

    const sumLines = result.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(baseProfile.totalBudgetInr);
  });

  it('strictly respects explicit user overrides', () => {
    const overrideDecor = 150_000;
    const profileWithOverride: EventProfile = {
      ...baseProfile,
      overrides: {
        decor: overrideDecor,
      },
    };

    const result = computeBudget(profileWithOverride, indiaLocalePack);
    const decorLine = result.lines.find((l) => l.id === 'decor');
    expect(decorLine).toBeDefined();
    expect(decorLine?.amount).toBe(overrideDecor);
    expect(decorLine?.source).toBe('override');

    const sumLines = result.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(baseProfile.totalBudgetInr);
  });

  it('evaluates catering estimates and status transitions (ok, tight, over)', () => {
    // Generous budget => ok
    const highBudgetProfile: EventProfile = {
      ...baseProfile,
      totalBudgetInr: 10_000_000,
    };
    const highResult = computeBudget(highBudgetProfile, indiaLocalePack);
    expect(['ok', 'tight']).toContain(highResult.estimates.catering.status);

    // Tiny budget => over
    const lowBudgetProfile: EventProfile = {
      ...baseProfile,
      totalBudgetInr: 500_000,
      guestCount: 400,
    };
    const lowResult = computeBudget(lowBudgetProfile, indiaLocalePack);
    expect(lowResult.estimates.catering.status).toBe('over');
    expect(lowResult.estimates.catering.suggestions).toBeDefined();
    expect(lowResult.estimates.catering.suggestions?.savingsNeeded).toBeGreaterThan(0);
  });

  it('proves catering suggestions maxGuestsForAllocation fits within allocation', () => {
    const tightProfile: EventProfile = {
      ...baseProfile,
      totalBudgetInr: 800_000,
      guestCount: 300,
    };

    const result = computeBudget(tightProfile, indiaLocalePack);
    const cateringLine = result.lines.find((l) => l.id === 'catering');
    const allocation = cateringLine ? cateringLine.amount : 0;
    const suggestions = result.estimates.catering.suggestions;

    if (suggestions) {
      const perGuestMid =
        result.estimates.catering.perPlateMid *
        result.estimates.catering.functionsFactor *
        result.estimates.catering.seasonFactor;

      const costAtMaxGuests = suggestions.maxGuestsForAllocation * perGuestMid;
      expect(costAtMaxGuests).toBeLessThanOrEqual(allocation);
    }
  });

  it('suggests cheaper alternative tiers for premium budget tier when over catering budget', () => {
    const premiumOverProfile: EventProfile = {
      ...baseProfile,
      budgetTier: 'premium',
      totalBudgetInr: 1_200_000,
      guestCount: 300,
    };

    const result = computeBudget(premiumOverProfile, indiaLocalePack);
    expect(result.estimates.catering.status).toBe('over');
    expect(result.estimates.catering.suggestions?.alternativeTier).toBeDefined();
    expect(['mid', 'budget']).toContain(result.estimates.catering.suggestions?.alternativeTier);
  });

  it('PROPERTY TEST: sum(lines) === total and no negative lines across random profiles and overrides', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EventType>(
          'wedding',
          'birthday_kids',
          'birthday_adult',
          'community_festival'
        ),
        fc.integer({ min: 10_000, max: 10_000_000 }),
        fc.integer({ min: 10, max: 1000 }),
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 1, max: 5 }),
        (eventType, totalBudgetInr, guestCount, venueIncluded, includeAttire, functionsCount) => {
          const profile: EventProfile = {
            eventType,
            eventDate: '2027-02-14',
            cityTier: 'tier1',
            cityName: 'Mumbai',
            guestCount,
            totalBudgetInr,
            budgetTier: 'mid',
            venueType: 'banquet',
            functionsCount: eventType === 'wedding' ? functionsCount : 1,
            dietary: { veg: guestCount, nonVeg: 0, jain: 0, vegan: 0 },
            toggles: {
              venueIncluded,
              includeAttireJewellery: eventType === 'wedding' ? includeAttire : false,
            },
            overrides: {},
            notes: undefined,
          };

          const result = computeBudget(profile, indiaLocalePack);

          // Invariant 1: sum(lines) == total
          const sum = result.lines.reduce((acc, l) => acc + l.amount, 0);
          expect(sum).toBe(totalBudgetInr);

          // Invariant 2: no negative lines
          for (const l of result.lines) {
            expect(l.amount).toBeGreaterThanOrEqual(0);
          }

          // Invariant 3: zero unallocated
          expect(result.unallocated).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
