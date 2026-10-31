import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeBudget } from '@/domain/rules/budget';
import { indiaLocalePack } from '@/domain/config/in';
import { EventProfile, EventType, CityTier, BudgetTier } from '@/domain/schemas/profile';

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

  it('suggests budget tier for premium profile when mid tier is over but budget tier fits (lines 307-309)', () => {
    // 150 guests, 2 functions (258.75 units).
    // Mid tier band mid = 2000 => 517,500.
    // Budget tier band mid = 1200 => 310,500.
    // With totalBudget = 1,800,000, catering allocation (25%) = 450,000.
    // Allocation 450,000 < Mid mid (517,500) -> Mid is over!
    // Allocation 450,000 > Budget mid (310,500) -> Budget is tight/ok!
    const premiumToBudgetProfile: EventProfile = {
      ...baseProfile,
      budgetTier: 'premium',
      totalBudgetInr: 1_800_000,
      guestCount: 150,
    };

    const result = computeBudget(premiumToBudgetProfile, indiaLocalePack);
    expect(result.estimates.catering.status).toBe('over');
    expect(result.estimates.catering.suggestions?.alternativeTier).toBe('budget');
  });

  it('suggests cheaper alternative tiers for premium budget tier when over catering budget and tier fits', () => {
    const premiumOverProfile: EventProfile = {
      ...baseProfile,
      budgetTier: 'premium',
      totalBudgetInr: 3_000_000,
      guestCount: 150,
    };

    const result = computeBudget(premiumOverProfile, indiaLocalePack);
    expect(result.estimates.catering.status).toBe('over');
    expect(result.estimates.catering.suggestions?.alternativeTier).toBe('mid');

    // Recomputing with suggested tier yields ok or tight, improving status
    const recomputed = computeBudget(
      {
        ...premiumOverProfile,
        budgetTier: result.estimates.catering.suggestions!.alternativeTier!,
      },
      indiaLocalePack
    );
    expect(['ok', 'tight']).toContain(recomputed.estimates.catering.status);
  });

  it('does NOT suggest alternative tier if recomputing still yields over (e.g. stressed wedding)', () => {
    const stressedProfile: EventProfile = {
      ...baseProfile,
      budgetTier: 'mid',
      totalBudgetInr: 2_500_000,
      guestCount: 300,
      functionsCount: 3,
    };

    const result = computeBudget(stressedProfile, indiaLocalePack);
    expect(result.estimates.catering.status).toBe('over');
    // For 300 guests with 3 functions at 25L, budget tier mid is 721,050 vs allocation 625,000 -> still over
    expect(result.estimates.catering.suggestions?.alternativeTier).toBeUndefined();
  });

  it('PROPERTY TEST: every returned suggestion, when applied, improves the status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<EventType>('wedding', 'birthday_kids', 'birthday_adult'),
        fc.integer({ min: 50_000, max: 20_000_000 }),
        fc.integer({ min: 10, max: 1000 }),
        fc.constantFrom<CityTier>('tier1', 'tier2', 'tier3'),
        fc.constantFrom<BudgetTier>('budget', 'mid', 'premium'),
        (eventType, totalBudgetInr, guestCount, cityTier, budgetTier) => {
          const testProfile: EventProfile = {
            eventType,
            eventDate: '2027-02-14',
            cityTier,
            cityName: 'Test City',
            guestCount,
            totalBudgetInr,
            budgetTier,
            venueType: 'lawn',
            functionsCount: 2,
            dietary: { veg: guestCount, nonVeg: 0, jain: 0, vegan: 0 },
            toggles: { venueIncluded: false, includeAttireJewellery: true },
            overrides: {},
            notes: '',
          };
          const initial = computeBudget(testProfile, indiaLocalePack);
          const suggestion = initial.estimates.catering.suggestions?.alternativeTier;
          if (suggestion) {
            const recomputed = computeBudget(
              { ...testProfile, budgetTier: suggestion },
              indiaLocalePack
            );
            const statusRank = { over: 0, tight: 1, ok: 2 };
            expect(recomputed.estimates.catering.status).not.toBe('over');
            expect(statusRank[recomputed.estimates.catering.status]).toBeGreaterThan(
              statusRank[initial.estimates.catering.status]
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('falls back to default band (500-1000) when catering bands are missing for cityTier/budgetTier (lines 251-253)', () => {
    const packWithMissingBands = {
      ...indiaLocalePack,
      cateringBands: {
        ...indiaLocalePack.cateringBands,
        tier1: {} as any,
      },
    };
    const result = computeBudget(baseProfile, packWithMissingBands);
    expect(result.estimates.catering.perPlateMin).toBe(500);
    expect(result.estimates.catering.perPlateMax).toBe(1000);
    expect(result.estimates.catering.perPlateMid).toBe(750);
  });

  it('evaluates contingencyMeetsFloor as false when contingency line is omitted from budget splits (line 328)', () => {
    const packWithoutContingency = {
      ...indiaLocalePack,
      budgetSplits: {
        ...indiaLocalePack.budgetSplits,
        wedding: indiaLocalePack.budgetSplits.wedding.filter((l) => l.id !== 'contingency'),
      },
    };
    const result = computeBudget(baseProfile, packWithoutContingency);
    expect(result.invariants.contingencyMeetsFloor).toBe(false);
  });

  it('reports contingencyMeetsFloor as false when an explicit override drops contingency below floor', () => {
    const profileWithLowContingency: EventProfile = {
      ...baseProfile,
      overrides: {
        contingency: 1000, // floor for 25L is 5% = 125,000
      },
    };
    const result = computeBudget(profileWithLowContingency, indiaLocalePack);
    expect(result.invariants.contingencyMeetsFloor).toBe(false);
    const contingencyLine = result.lines.find((l) => l.id === 'contingency');
    expect(contingencyLine?.amount).toBe(1000);
  });

  it('absorbs budget difference into adjustTarget when only overridden items exist below total budget (lines 225-240)', () => {
    const singleCategoryPack = {
      ...indiaLocalePack,
      budgetSplits: {
        ...indiaLocalePack.budgetSplits,
        wedding: [
          {
            id: 'catering',
            label: 'Catering',
            weight: 100,
            source: 'assumption' as const,
          },
        ],
      },
    };

    const profile: EventProfile = {
      ...baseProfile,
      totalBudgetInr: 1_000_000,
      overrides: {
        catering: 800_000, // overridden below total, no dynamic items remaining
      },
    };

    const result = computeBudget(profile, singleCategoryPack);
    expect(result.invariants.sumEqualsTotal).toBe(true);
    expect(result.lines[0]!.amount).toBe(1_000_000);
    expect(result.lines[0]!.percent).toBe(100);
  });

  it('handles overrides exceeding total budget gracefully with contingency at 0', () => {
    const profileWithExcessiveOverrides: EventProfile = {
      ...baseProfile,
      totalBudgetInr: 1_000_000,
      overrides: {
        catering: 700_000,
        venue: 500_000, // total overrides = 1,200,000 > 1,000,000
      },
    };
    const result = computeBudget(profileWithExcessiveOverrides, indiaLocalePack);
    expect(result.lines.find((l) => l.id === 'contingency')?.amount).toBe(0);
    expect(result.invariants.contingencyMeetsFloor).toBe(false);
    expect(result.invariants.noNegativeLines).toBe(true);
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
