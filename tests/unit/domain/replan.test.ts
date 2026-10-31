import { describe, it, expect } from 'vitest';
import { replan } from '@/domain/rules/replan';
import { buildPlan } from '@/domain/rules/plan';
import { indiaLocalePack } from '@/domain/config/in';
import { EventProfile } from '@/domain/schemas/profile';
import {
  weddingDefault,
  weddingStressed,
  weddingPuneFixture,
  FROZEN_TODAY,
} from '@/domain/fixtures/profiles';

describe('Replan Engine (src/domain/rules/replan.ts)', () => {
  const TODAY = FROZEN_TODAY;

  const defaultWeddingPlan = buildPlan(weddingDefault, TODAY, indiaLocalePack);
  const stressedWeddingPlan = buildPlan(weddingStressed, TODAY, indiaLocalePack);

  it('replan(weddingDefault, {guestCount: 300}) shifts catering from ok to over, adds flag, and includes delta in summaryFacts', () => {
    // Initial: 200 guests, 40L, catering allocation 10L, status ok, no catering_over flag
    expect(defaultWeddingPlan.budget.estimates.catering.status).toBe('ok');
    expect(defaultWeddingPlan.flags.some((f) => f.code === 'catering_over')).toBe(false);

    const result = replan(defaultWeddingPlan, { guestCount: 300 }, TODAY, indiaLocalePack);
    expect(result.ok).toBe(true);

    if (result.ok) {
      // 1. Shifted catering status from ok to over
      expect(result.plan.budget.estimates.catering.status).toBe('over');

      // 2. Flags added includes catering_over
      expect(result.diff.flagsAdded).toContain('catering_over');
      expect(result.plan.flags.some((f) => f.code === 'catering_over')).toBe(true);

      // 3. Catering estimate delta > 0 and reflected in summaryFacts
      expect(result.diff.cateringEstimateDelta).toBeGreaterThan(0);
      expect(
        result.diff.summaryFacts.some((f) =>
          f.includes('Estimated catering requirement shifted by')
        )
      ).toBe(true);
      expect(
        result.diff.summaryFacts.some((f) =>
          f.includes('New advisory notice(s) raised: catering_over')
        )
      ).toBe(true);
      expect(
        result.diff.summaryFacts.some((f) => f.includes('Guest count adjusted from 200 to 300'))
      ).toBe(true);
    }
  });

  it('replan from stressed plan to lower guests resolves catering_over and records flagsRemoved in summaryFacts', () => {
    expect(stressedWeddingPlan.flags.some((f) => f.code === 'catering_over')).toBe(true);

    // Drop guests from 300 to 80 and adjust dietary proportionally
    const result = replan(
      stressedWeddingPlan,
      {
        guestCount: 80,
        dietary: { veg: 70, nonVeg: 0, jain: 10, vegan: 0 },
      },
      TODAY,
      indiaLocalePack
    );
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.plan.budget.estimates.catering.status).toBe('ok');
      expect(result.diff.flagsRemoved).toContain('catering_over');
      expect(
        result.diff.summaryFacts.some((f) =>
          f.includes('Resolved advisory notice(s): catering_over')
        )
      ).toBe(true);
    }
  });

  it('handles checklist items removal when switching away from conditional venue', () => {
    // First, add destination venue
    const destResult = replan(
      defaultWeddingPlan,
      { venueType: 'destination' },
      TODAY,
      indiaLocalePack
    );
    expect(destResult.ok).toBe(true);
    if (!destResult.ok) return;

    expect(destResult.diff.checklistAdded).toContain('travel_stay');

    // Now revert back to banquet venue
    const revertResult = replan(destResult.plan, { venueType: 'banquet' }, TODAY, indiaLocalePack);
    expect(revertResult.ok).toBe(true);
    if (revertResult.ok) {
      expect(revertResult.diff.checklistRemoved).toContain('travel_stay');
      expect(
        revertResult.diff.summaryFacts.some((f) =>
          f.includes('Removed 1 checklist item(s): travel_stay')
        )
      ).toBe(true);
    }
  });

  it('handles event date shift and calculates milestone shifts', () => {
    const standardWeddingProfile: EventProfile = {
      ...weddingPuneFixture,
      eventDate: '2027-10-29', // 365 days away
    };
    const standardPlan = buildPlan(standardWeddingProfile, TODAY, indiaLocalePack);

    // Move event 15 days later in standard mode
    const patch = { eventDate: '2027-11-13' };
    const result = replan(standardPlan, patch, TODAY, indiaLocalePack);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diff.milestonesShifted.length).toBeGreaterThan(0);
      expect(result.diff.milestonesShifted.every((m) => m.daysDelta === 15)).toBe(true);
      expect(result.diff.summaryFacts.some((f) => f.includes('+15 days'))).toBe(true);
    }
  });

  it('handles budget adjustment delta in summaryFacts', () => {
    const patch = { totalBudgetInr: 5_000_000 };
    const result = replan(defaultWeddingPlan, patch, TODAY, indiaLocalePack);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diff.totalDelta).toBe(1_000_000);
      expect(
        result.diff.summaryFacts.some((f) =>
          f.includes('Total event budget changed by +₹10,00,000')
        )
      ).toBe(true);
    }
  });

  it('returns empty diff for a no-op patch', () => {
    const patch = {};
    const result = replan(defaultWeddingPlan, patch, TODAY, indiaLocalePack);

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

  it('proportionally scales down dietary requirements without validation errors when guestCount drops', () => {
    // Wedding with 200 guests and dietary veg: 100, nonVeg: 50, jain: 30, vegan: 20 (sum: 200)
    const customProfile = {
      ...weddingDefault,
      guestCount: 200,
      dietary: { veg: 100, nonVeg: 50, jain: 30, vegan: 20 },
    };
    const plan = buildPlan(customProfile, TODAY, indiaLocalePack);

    // Reduce to 50 guests
    const result = replan(plan, { guestCount: 50 }, TODAY, indiaLocalePack);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.profile.guestCount).toBe(50);
      const { veg, nonVeg, jain, vegan } = result.plan.profile.dietary;
      expect(veg + nonVeg + jain + vegan).toBeLessThanOrEqual(50);
      expect(veg).toBeGreaterThan(0);
      expect(nonVeg).toBeGreaterThan(0);
    }
  });

  it('rejects an invalid patch with validation errors', () => {
    const invalidPatch = { guestCount: -50 };
    const result = replan(defaultWeddingPlan, invalidPatch, TODAY, indiaLocalePack);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.path.includes('guestCount'))).toBe(true);
    }
  });
});
