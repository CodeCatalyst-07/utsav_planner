import { describe, it, expect } from 'vitest';
import { replan } from '@/domain/rules/replan';
import { buildPlan } from '@/domain/rules/plan';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('What-If Replan & Diff View-Model (src/domain/rules/replan.ts)', () => {
  const today = '2026-10-29';
  const basePlan = buildPlan(weddingPuneFixture, today);

  it('computes positive catering and guest deltas when guests increase from 200 to 300', () => {
    const res = replan(basePlan, { guestCount: 300 }, today);
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.diff.cateringEstimateDelta).toBeGreaterThan(0);
      expect(res.plan.budget.estimates.catering.mid).toBeGreaterThan(
        basePlan.budget.estimates.catering.mid
      );
      // Status should become tighter or over
      expect(['tight', 'over']).toContain(res.plan.budget.estimates.catering.status);
      expect(res.diff.summaryFacts.length).toBeGreaterThan(0);
      expect(
        res.diff.summaryFacts.some((f) => f.includes('Estimated catering requirement shifted'))
      ).toBe(true);
    }
  });

  it('detects shifted milestones when event date moves forward', () => {
    const res = replan(basePlan, { eventDate: '2027-08-15' }, today);
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.diff.milestonesShifted.length).toBeGreaterThan(0);
      const shift = res.diff.milestonesShifted[0];
      expect(Math.abs(shift?.daysDelta ?? 0)).toBeGreaterThan(0);
    }
  });

  it('computes total budget delta when budget is adjusted in what-if', () => {
    const res = replan(basePlan, { totalBudgetInr: 5000000 }, today);
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.diff.totalDelta).toBe(1000000);
      expect(res.diff.summaryFacts.some((f) => f.includes('Total event budget changed'))).toBe(
        true
      );
    }
  });

  it('rejects invalid what-if parameters with validation errors', () => {
    const res = replan(basePlan, { guestCount: -50 }, today);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.length).toBeGreaterThan(0);
    }
  });
});
