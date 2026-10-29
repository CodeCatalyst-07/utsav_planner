import { describe, it, expect } from 'vitest';
import { buildPlan } from '@/domain/rules/plan';
import { indiaLocalePack } from '@/domain/config/in';
import {
  weddingPuneFixture,
  birthdayKidsIndoreFixture,
  communityGaneshMumbaiFixture,
  FROZEN_TODAY,
} from '@/domain/fixtures/profiles';

describe('Domain Fixtures (src/domain/fixtures/profiles.ts)', () => {
  it('generates expected plan for Fixture 1: Wedding in Pune (₹25L, 300 guests, 3 functions)', () => {
    const plan = buildPlan(weddingPuneFixture, FROZEN_TODAY, indiaLocalePack);

    expect(plan.daysToEvent).toBe(108); // 2026-10-29 to 2027-02-14
    expect(plan.mode).toBe('compressed'); // 108 < 180 minLeadDays

    // Budget Lines
    expect(plan.budget.total).toBe(2_500_000);
    const sumLines = plan.budget.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(2_500_000);
    expect(plan.budget.invariants.sumEqualsTotal).toBe(true);

    // Milestones
    expect(plan.timeline.milestones.length).toBe(11);
    expect(plan.timeline.criticalVendorsUnavailableNotice).toBe(true);

    // Checklist
    expect(plan.checklist.items.length).toBeGreaterThanOrEqual(16);

    // Flags: peak season (Feb) + muhurat verify + compressed plan + jain dietary
    expect(plan.flags.some((f) => f.code === 'peak_season')).toBe(true);
    expect(plan.flags.some((f) => f.code === 'wedding_muhurat_verify')).toBe(true);
    expect(plan.flags.some((f) => f.code === 'compressed_plan')).toBe(true);
  });

  it('generates expected plan for Fixture 2: Kids 5th Birthday in Indore (₹60k, 40 guests)', () => {
    const plan = buildPlan(birthdayKidsIndoreFixture, FROZEN_TODAY, indiaLocalePack);

    expect(plan.daysToEvent).toBe(47); // 2026-10-29 to 2026-12-15
    expect(plan.mode).toBe('standard'); // 47 >= 28 minLeadDays

    // Budget Lines
    expect(plan.budget.total).toBe(60_000);
    const sumLines = plan.budget.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(60_000);

    // Venue was toggled included (free/home)
    const venueLine = plan.budget.lines.find((l) => l.id === 'venue');
    expect(venueLine?.amount).toBe(0);

    // Safety first aid item has high priority
    const safetyItem = plan.checklist.items.find((i) => i.id === 'safety_first_aid');
    expect(safetyItem?.priority).toBe('high');
  });

  it('generates expected plan for Fixture 3: Community Ganeshotsav in Mumbai (₹4L, 500 guests)', () => {
    const plan = buildPlan(communityGaneshMumbaiFixture, FROZEN_TODAY, indiaLocalePack);

    expect(plan.daysToEvent).toBe(320); // 2026-10-29 to 2027-09-14
    expect(plan.mode).toBe('standard'); // 320 >= 70 minLeadDays

    // Budget Lines
    expect(plan.budget.total).toBe(400_000);
    const sumLines = plan.budget.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(400_000);

    // September is monsoon month => outdoor warning for community_hall outdoor type
    expect(plan.flags.some((f) => f.code === 'monsoon_outdoor')).toBe(true);

    // Community permissions verification flag
    expect(plan.flags.some((f) => f.code === 'community_permissions_verify')).toBe(true);

    // Post-event milestones
    const postEventMilestones = plan.timeline.milestones.filter((m) => m.phase === 'after');
    expect(postEventMilestones.length).toBe(2);
  });
});
