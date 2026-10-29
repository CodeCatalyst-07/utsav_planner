import { describe, it, expect } from 'vitest';
import { replan } from '@/domain/rules/replan';
import { buildPlan } from '@/domain/rules/plan';
import { indiaLocalePack } from '@/domain/config/in';
import { EventProfile } from '@/domain/schemas/profile';

describe('Replan Engine (src/domain/rules/replan.ts)', () => {
  const TODAY = '2026-10-29';

  const baseWeddingProfile: EventProfile = {
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

  const initialPlan = buildPlan(baseWeddingProfile, TODAY, indiaLocalePack);

  const standardWeddingProfile: EventProfile = {
    ...baseWeddingProfile,
    eventDate: '2027-10-29', // 365 days away (standard mode, minLeadDays = 180)
  };
  const standardPlan = buildPlan(standardWeddingProfile, TODAY, indiaLocalePack);

  it('handles guest count adjustment and calculates catering estimate delta', () => {
    const patch = { guestCount: 350 };
    const result = replan(initialPlan, patch, TODAY, indiaLocalePack);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.profile.guestCount).toBe(350);
      expect(result.diff.cateringEstimateDelta).toBeGreaterThan(0);
      expect(result.diff.summaryFacts.some((f) => f.includes('350'))).toBe(true);
      expect(result.diff.totalDelta).toBe(0);
    }
  });

  it('handles event date shift and calculates milestone shifts', () => {
    // Move event 15 days later in standard mode
    const patch = { eventDate: '2027-11-13' }; // 15 days after 2027-10-29
    const result = replan(standardPlan, patch, TODAY, indiaLocalePack);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diff.milestonesShifted.length).toBeGreaterThan(0);
      expect(result.diff.milestonesShifted.every((m) => m.daysDelta === 15)).toBe(true);
      expect(result.diff.summaryFacts.some((f) => f.includes('+15 days'))).toBe(true);
    }
  });

  it('returns empty diff for a no-op patch (empty or identical values)', () => {
    const patch = {};
    const result = replan(initialPlan, patch, TODAY, indiaLocalePack);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diff.budgetLines).toEqual([]);
      expect(result.diff.totalDelta).toBe(0);
      expect(result.diff.cateringEstimateDelta).toBe(0);
      expect(result.diff.milestonesShifted).toEqual([]);
      expect(result.diff.checklistAdded).toEqual([]);
      expect(result.diff.checklistRemoved).toEqual([]);
      expect(result.diff.flagsAdded).toEqual([]);
      expect(result.diff.flagsRemoved).toEqual([]);
      expect(result.diff.summaryFacts).toEqual([]);
    }
  });

  it('rejects an invalid patch with validation errors', () => {
    const invalidPatch = { guestCount: -50 };
    const result = replan(initialPlan, invalidPatch, TODAY, indiaLocalePack);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.path.includes('guestCount'))).toBe(true);
    }
  });

  it('updates checklist items when toggling destination venue', () => {
    const patch = { venueType: 'destination' };
    const result = replan(initialPlan, patch, TODAY, indiaLocalePack);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diff.checklistAdded).toContain('travel_stay');
      expect(result.diff.summaryFacts.some((f) => f.includes('travel_stay'))).toBe(true);
    }
  });
});
