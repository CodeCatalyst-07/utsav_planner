import { describe, it, expect } from 'vitest';
import { buildPlan } from '@/domain/rules/plan';
import { indiaLocalePack } from '@/domain/config/in';
import {
  weddingPuneFixture,
  weddingStressedFixture,
  birthdayKidsIndoreFixture,
  communityGaneshMumbaiFixture,
  buildSampleProfile,
  SampleProfileKind,
  FROZEN_TODAY,
} from '@/domain/fixtures/profiles';
import { addDays } from '@/domain/dates';

describe('Domain Fixtures (src/domain/fixtures/profiles.ts)', () => {
  it('generates expected plan for Default Fixture 1: Wedding in Pune (₹40L, 200 guests, 2 functions)', () => {
    const plan = buildPlan(weddingPuneFixture, FROZEN_TODAY, indiaLocalePack);

    expect(plan.daysToEvent).toBe(108); // 2026-10-29 to 2027-02-14
    expect(plan.mode).toBe('compressed'); // 108 < 180 minLeadDays

    // Budget Lines
    expect(plan.budget.total).toBe(4_000_000);
    const sumLines = plan.budget.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(4_000_000);
    expect(plan.budget.invariants.sumEqualsTotal).toBe(true);

    // Catering calculation: allocation 10L vs estimates [441.6k, 680.8k, 920k] => ok
    const cateringLine = plan.budget.lines.find((l) => l.id === 'catering');
    expect(cateringLine?.amount).toBe(1_000_000);
    expect(plan.budget.estimates.catering.low).toBe(441_600);
    expect(plan.budget.estimates.catering.mid).toBe(680_800);
    expect(plan.budget.estimates.catering.high).toBe(920_000);
    expect(plan.budget.estimates.catering.status).toBe('ok');

    // Milestones & Checklist
    expect(plan.timeline.milestones.length).toBe(11);
    expect(plan.checklist.items.length).toBe(18); // 16 base + multi_function_flow + jain_kitchen_setup

    // Flags: peak season (Feb) + muhurat verify + compressed plan + special diet counters (10 Jain)
    expect(plan.flags.some((f) => f.code === 'peak_season')).toBe(true);
    expect(plan.flags.some((f) => f.code === 'wedding_muhurat_verify')).toBe(true);
    expect(plan.flags.some((f) => f.code === 'compressed_plan')).toBe(true);
    expect(plan.flags.some((f) => f.code === 'special_diet_counters')).toBe(true);
    expect(plan.flags.some((f) => f.code === 'catering_over')).toBe(false);
  });

  it('generates expected plan for Stressed Case Fixture: Wedding in Pune (₹25L, 300 guests, 3 functions)', () => {
    const plan = buildPlan(weddingStressedFixture, FROZEN_TODAY, indiaLocalePack);

    expect(plan.daysToEvent).toBe(108);
    expect(plan.mode).toBe('compressed');

    // Budget Lines
    expect(plan.budget.total).toBe(2_500_000);
    const sumLines = plan.budget.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(2_500_000);

    // Catering calculation: allocation 6.25L vs estimates [910.8k, 1404.15k, 1897.5k] => over
    const cateringLine = plan.budget.lines.find((l) => l.id === 'catering');
    expect(cateringLine?.amount).toBe(625_000);
    expect(plan.budget.estimates.catering.low).toBe(910_800);
    expect(plan.budget.estimates.catering.mid).toBe(1_404_150);
    expect(plan.budget.estimates.catering.high).toBe(1_897_500);
    expect(plan.budget.estimates.catering.status).toBe('over');
    expect(plan.budget.estimates.catering.suggestions?.savingsNeeded).toBe(779_150);
    // Verified: budget tier mid is 721,050 vs allocation 625,000, so alternativeTier must NOT be suggested
    expect(plan.budget.estimates.catering.suggestions?.alternativeTier).toBeUndefined();

    // Milestones & Checklist
    expect(plan.timeline.milestones.length).toBe(11);
    expect(plan.checklist.items.length).toBe(18); // 16 base + multi_function_flow + jain_kitchen_setup

    // Flags: includes critical catering_over flag
    expect(plan.flags.some((f) => f.code === 'catering_over' && f.severity === 'critical')).toBe(
      true
    );
    expect(plan.flags.some((f) => f.code === 'special_diet_counters')).toBe(true);
  });

  it('generates expected plan for Fixture 2: Kids 5th Birthday in Indore (₹100k, 40 guests)', () => {
    const plan = buildPlan(birthdayKidsIndoreFixture, FROZEN_TODAY, indiaLocalePack);

    expect(plan.daysToEvent).toBe(47); // 2026-10-29 to 2026-12-15
    expect(plan.mode).toBe('standard'); // 47 >= 28 minLeadDays

    // Budget Lines
    expect(plan.budget.total).toBe(100_000);
    const sumLines = plan.budget.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(100_000);

    // Venue was toggled included (free/home)
    const venueLine = plan.budget.lines.find((l) => l.id === 'venue');
    expect(venueLine?.amount).toBe(0);

    // Catering: allocation 40k vs estimates [18k, 27k, 36k] => ok
    const cateringLine = plan.budget.lines.find((l) => l.id === 'catering');
    expect(cateringLine?.amount).toBe(40_000);
    expect(plan.budget.estimates.catering.low).toBe(18_000);
    expect(plan.budget.estimates.catering.mid).toBe(27_000);
    expect(plan.budget.estimates.catering.high).toBe(36_000);
    expect(plan.budget.estimates.catering.status).toBe('ok');

    // Safety first aid item has high priority
    const safetyItem = plan.checklist.items.find((i) => i.id === 'safety_first_aid');
    expect(safetyItem?.priority).toBe('high');
    expect(plan.checklist.items.length).toBe(10); // 9 base + jain_kitchen_setup
    expect(plan.flags.some((f) => f.code === 'special_diet_counters')).toBe(true);
  });

  it('generates expected plan for Fixture 3: Community Ganeshotsav in Mumbai (₹4L, 500 guests)', () => {
    const plan = buildPlan(communityGaneshMumbaiFixture, FROZEN_TODAY, indiaLocalePack);

    expect(plan.daysToEvent).toBe(320); // 2026-10-29 to 2027-09-14
    expect(plan.mode).toBe('standard'); // 320 >= 70 minLeadDays

    // Budget Lines
    expect(plan.budget.total).toBe(400_000);
    const sumLines = plan.budget.lines.reduce((acc, l) => acc + l.amount, 0);
    expect(sumLines).toBe(400_000);

    // Catering: allocation 80k vs estimates [25k, 50k, 75k] => ok
    const cateringLine = plan.budget.lines.find((l) => l.id === 'catering');
    expect(cateringLine?.amount).toBe(80_000);
    expect(plan.budget.estimates.catering.low).toBe(25_000);
    expect(plan.budget.estimates.catering.mid).toBe(50_000);
    expect(plan.budget.estimates.catering.high).toBe(75_000);
    expect(plan.budget.estimates.catering.status).toBe('ok');

    // September is monsoon month => outdoor warning for community_hall outdoor type
    expect(plan.flags.some((f) => f.code === 'monsoon_outdoor')).toBe(true);

    // Community permissions verification flag
    expect(plan.flags.some((f) => f.code === 'community_permissions_verify')).toBe(true);
    expect(plan.flags.some((f) => f.code === 'special_diet_counters')).toBe(true);
    expect(plan.checklist.items.length).toBe(14); // 12 base + backup_tent + jain_kitchen_setup

    // Post-event milestones
    const postEventMilestones = plan.timeline.milestones.filter((m) => m.phase === 'after');
    expect(postEventMilestones.length).toBe(2);
  });

  it('buildSampleProfile creates profiles using relative dates that always build in standard mode for any today in a sample year', () => {
    const kinds: SampleProfileKind[] = ['wedding', 'birthday_kids', 'community_festival'];
    // Sample dates across all 12 months in 2026 including leap-year adjacent
    const sampleDates: string[] = [];
    for (let month = 1; month <= 12; month++) {
      const mStr = String(month).padStart(2, '0');
      sampleDates.push(`2026-${mStr}-01`);
      sampleDates.push(`2026-${mStr}-15`);
    }

    for (const today of sampleDates) {
      for (const kind of kinds) {
        const profile = buildSampleProfile(kind, today);
        const plan = buildPlan(profile, today, indiaLocalePack);

        expect(plan.mode).toBe('standard');
        expect(plan.budget.invariants.sumEqualsTotal).toBe(true);
        expect(plan.budget.invariants.noNegativeLines).toBe(true);
        expect(plan.timeline.milestones.length).toBeGreaterThan(0);
        expect(plan.checklist.items.length).toBeGreaterThan(0);
      }
    }
  });
});
