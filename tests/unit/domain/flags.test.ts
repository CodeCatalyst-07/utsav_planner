import { describe, it, expect } from 'vitest';
import { computeFlags } from '@/domain/rules/flags';
import { computeBudget } from '@/domain/rules/budget';
import { computeTimeline } from '@/domain/rules/timeline';
import { indiaLocalePack } from '@/domain/config/in';
import { EventProfile } from '@/domain/schemas/profile';
import { addDays } from '@/domain/dates';

describe('Flags Engine (src/domain/rules/flags.ts)', () => {
  const TODAY = '2026-10-29';

  const baseWeddingProfile: EventProfile = {
    eventType: 'wedding',
    eventDate: '2027-02-14', // Feb is peak wedding season
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

  describe('1. compressed_plan (positive and negative)', () => {
    it('raises warning when daysToEvent is compressed between 30 and minLeadDays', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: '2027-01-15', // ~78 days, minLeadDays 180
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'compressed_plan');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('warning');
    });

    it('raises critical when daysToEvent is under 30 days', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: '2026-11-15', // 17 days
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'compressed_plan');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('critical');
    });

    it('does not raise compressed_plan when timeline is >= minLeadDays (standard mode)', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: '2027-10-29', // 365 days
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'compressed_plan')).toBe(false);
    });
  });

  describe('2. peak_season (positive and negative)', () => {
    it('raises peak_season flag when wedding falls in Nov-Feb peak months', () => {
      const budget = computeBudget(baseWeddingProfile, indiaLocalePack);
      const timeline = computeTimeline(baseWeddingProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(baseWeddingProfile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'peak_season');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('info');
      expect(flag?.params).toEqual({ factor: 1.15 });
    });

    it('does not raise peak_season when wedding falls in off-peak months', () => {
      const offPeakProfile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: '2027-04-15', // April is off-peak
      };
      const budget = computeBudget(offPeakProfile, indiaLocalePack);
      const timeline = computeTimeline(offPeakProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(offPeakProfile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'peak_season')).toBe(false);
    });
  });

  describe('3. monsoon_outdoor (positive and negative)', () => {
    it('raises monsoon_outdoor warning for outdoor venue during June-September', () => {
      const monsoonProfile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: '2027-07-20',
        venueType: 'lawn',
      };
      const budget = computeBudget(monsoonProfile, indiaLocalePack);
      const timeline = computeTimeline(monsoonProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(monsoonProfile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'monsoon_outdoor');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('warning');
    });

    it('does not raise monsoon_outdoor when venue is indoors during monsoon', () => {
      const indoorProfile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: '2027-07-20',
        venueType: 'banquet',
      };
      const budget = computeBudget(indoorProfile, indiaLocalePack);
      const timeline = computeTimeline(indoorProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(indoorProfile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'monsoon_outdoor')).toBe(false);
    });

    it('does not raise monsoon_outdoor when outdoor venue is in non-monsoon months', () => {
      const drySeasonProfile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: '2027-02-14',
        venueType: 'lawn',
      };
      const budget = computeBudget(drySeasonProfile, indiaLocalePack);
      const timeline = computeTimeline(drySeasonProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(drySeasonProfile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'monsoon_outdoor')).toBe(false);
    });
  });

  describe('4 & 5. catering_over and catering_tight (positive and negative)', () => {
    it('raises catering_over (critical) with required params when allocation < mid estimate', () => {
      const underfundedProfile: EventProfile = {
        ...baseWeddingProfile,
        totalBudgetInr: 1_000_000,
        guestCount: 300,
      };
      const budget = computeBudget(underfundedProfile, indiaLocalePack);
      const timeline = computeTimeline(underfundedProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(underfundedProfile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'catering_over');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('critical');
      expect(flag?.params).toHaveProperty('allocation');
      expect(flag?.params).toHaveProperty('estimateMid');
      expect(flag?.params).toHaveProperty('estimateHigh');
      expect(flag?.params).toHaveProperty('suggestions');
    });

    it('raises catering_tight (warning) with required params when allocation >= mid but < high', () => {
      // Find budget where allocation sits between mid and high
      // Wedding 200 guests, 1 function, off-peak April (units = 200)
      // Tier 1 mid band: min 1200, max 2500, mid 1850 -> low 240k, mid 370k, high 500k
      // With 25% catering split, total budget = 1,600,000 gives catering = 400,000 (between 370k and 500k)
      const tightProfile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: '2027-04-15',
        guestCount: 200,
        functionsCount: 1,
        totalBudgetInr: 1_600_000,
      };
      const budget = computeBudget(tightProfile, indiaLocalePack);
      const timeline = computeTimeline(tightProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(tightProfile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'catering_tight');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('warning');
      expect(flag?.params).toHaveProperty('allocation');
      expect(flag?.params).toHaveProperty('estimateMid');
      expect(flag?.params).toHaveProperty('estimateHigh');
      expect(flag?.params).toHaveProperty('suggestions');
      expect(flags.some((f) => f.code === 'catering_over')).toBe(false);
    });

    it('does not raise catering_over or catering_tight when allocation >= high estimate (ok status)', () => {
      const wellFundedProfile: EventProfile = {
        ...baseWeddingProfile,
        totalBudgetInr: 4_000_000,
        guestCount: 200,
        functionsCount: 2,
      };
      const budget = computeBudget(wellFundedProfile, indiaLocalePack);
      const timeline = computeTimeline(wellFundedProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(wellFundedProfile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'catering_over')).toBe(false);
      expect(flags.some((f) => f.code === 'catering_tight')).toBe(false);
    });
  });

  describe('6. per_head_budget_low (positive and negative)', () => {
    it('raises per_head_budget_low for weddings when budget per head < 2500', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        guestCount: 2000,
        totalBudgetInr: 100_000, // ₹50/guest
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'per_head_budget_low');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('warning');
    });

    it('raises per_head_budget_low for kids birthdays when budget per head < 500', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        eventType: 'birthday_kids',
        guestCount: 50,
        totalBudgetInr: 15_000, // ₹300/guest < ₹500 threshold
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'per_head_budget_low');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('warning');
    });

    it('raises per_head_budget_low for community festivals when budget per head < 100', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        eventType: 'community_festival',
        guestCount: 1000,
        totalBudgetInr: 50_000, // ₹50/guest < ₹100 threshold
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'per_head_budget_low');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('warning');
    });

    it('does not raise per_head_budget_low when budget per head meets threshold', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        guestCount: 100,
        totalBudgetInr: 1_000_000, // ₹10,000/head
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'per_head_budget_low')).toBe(false);
    });
  });

  describe('7. contingency_below_floor (positive and negative)', () => {
    it('raises contingency_below_floor when user override forces contingency < 5%', () => {
      const lowContingencyProfile: EventProfile = {
        ...baseWeddingProfile,
        overrides: { contingency: 1000 },
      };
      const budget = computeBudget(lowContingencyProfile, indiaLocalePack);
      const timeline = computeTimeline(lowContingencyProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(lowContingencyProfile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'contingency_below_floor');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('warning');
    });

    it('does not raise contingency_below_floor when default 5% floor is maintained', () => {
      const budget = computeBudget(baseWeddingProfile, indiaLocalePack);
      const timeline = computeTimeline(baseWeddingProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(baseWeddingProfile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'contingency_below_floor')).toBe(false);
    });
  });

  describe('8. special_diet_counters (positive and negative)', () => {
    it('raises special_diet_counters with Jain count', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        dietary: { veg: 280, nonVeg: 0, jain: 20, vegan: 0 },
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'special_diet_counters');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('info');
      expect(flag?.message).toContain('20 Jain');
    });

    it('raises special_diet_counters with Vegan count', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        dietary: { veg: 280, nonVeg: 0, jain: 0, vegan: 20 },
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'special_diet_counters');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('info');
      expect(flag?.message).toContain('20 Vegan');
    });

    it('raises special_diet_counters with both Jain and Vegan counts', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        dietary: { veg: 260, nonVeg: 0, jain: 20, vegan: 20 },
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'special_diet_counters');
      expect(flag).toBeDefined();
      expect(flag?.message).toContain('20 Jain, 20 Vegan');
    });

    it('does not raise special_diet_counters when jain and vegan are 0', () => {
      const profile: EventProfile = {
        ...baseWeddingProfile,
        dietary: { veg: 300, nonVeg: 0, jain: 0, vegan: 0 },
      };
      const budget = computeBudget(profile, indiaLocalePack);
      const timeline = computeTimeline(profile, indiaLocalePack, TODAY);
      const flags = computeFlags(profile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'special_diet_counters')).toBe(false);
    });
  });

  describe('9. wedding_muhurat_verify (positive and negative)', () => {
    it('raises wedding_muhurat_verify for wedding event type', () => {
      const budget = computeBudget(baseWeddingProfile, indiaLocalePack);
      const timeline = computeTimeline(baseWeddingProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(baseWeddingProfile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'wedding_muhurat_verify');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('info');
    });

    it('does not raise wedding_muhurat_verify for non-wedding events', () => {
      const birthdayProfile: EventProfile = {
        ...baseWeddingProfile,
        eventType: 'birthday_kids',
        functionsCount: 1,
      };
      const budget = computeBudget(birthdayProfile, indiaLocalePack);
      const timeline = computeTimeline(birthdayProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(birthdayProfile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'wedding_muhurat_verify')).toBe(false);
    });
  });

  describe('10. community_permissions_verify (positive and negative)', () => {
    it('raises community_permissions_verify for community_festival event type', () => {
      const communityProfile: EventProfile = {
        ...baseWeddingProfile,
        eventType: 'community_festival',
        functionsCount: 1,
      };
      const budget = computeBudget(communityProfile, indiaLocalePack);
      const timeline = computeTimeline(communityProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(communityProfile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'community_permissions_verify');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('info');
    });

    it('does not raise community_permissions_verify for wedding or birthday events', () => {
      const budget = computeBudget(baseWeddingProfile, indiaLocalePack);
      const timeline = computeTimeline(baseWeddingProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(baseWeddingProfile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'community_permissions_verify')).toBe(false);
    });
  });

  describe('11. catch_up_needed (positive and negative)', () => {
    it('raises catch_up_needed with warning severity when a critical milestone was >= 45 days past its standard date', () => {
      // Wedding at +360 days: wedding_budget (offset 420) is 60 days past (>= 45), wedding_muhurat (offset 400) is 40 days past
      const weddingProfile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: addDays(TODAY, 360),
      };
      const budget = computeBudget(weddingProfile, indiaLocalePack);
      const timeline = computeTimeline(weddingProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(weddingProfile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'catch_up_needed');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('warning');
      expect(flag?.params).toEqual({ count: 2, criticalCount: 2 });
      expect(flag?.message).toContain('2 planning milestones (2 critical)');
    });

    it('raises catch_up_needed with info severity when a critical milestone was caught up but < 45 days past', () => {
      // Wedding at +410 days: wedding_budget (offset 420) is 10 days past (< 45 days)
      const weddingProfile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: addDays(TODAY, 410),
      };
      const budget = computeBudget(weddingProfile, indiaLocalePack);
      const timeline = computeTimeline(weddingProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(weddingProfile, budget, timeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'catch_up_needed');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('info');
      expect(flag?.params).toEqual({ count: 1, criticalCount: 1 });
      expect(flag?.message).toContain('1 planning milestone (1 critical)');
    });

    it('raises catch_up_needed with info severity when only non-critical milestones are caught up', () => {
      const customTimeline = {
        mode: 'standard' as const,
        daysToEvent: 200,
        minLeadDays: 180,
        criticalVendorsUnavailableNotice: false,
        milestones: [
          {
            id: 'non_crit_1',
            title: 'Non Critical Task',
            detail: 'Detail',
            date: TODAY,
            daysBeforeEvent: 200,
            standardOffsetDays: 220,
            critical: false,
            phase: 'before' as const,
            catchUp: true,
          },
        ],
      };
      const budget = computeBudget(baseWeddingProfile, indiaLocalePack);
      const flags = computeFlags(baseWeddingProfile, budget, customTimeline, indiaLocalePack);

      const flag = flags.find((f) => f.code === 'catch_up_needed');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('info');
      expect(flag?.params).toEqual({ count: 1, criticalCount: 0 });
    });

    it('does not raise catch_up_needed when no milestones require catch-up', () => {
      // Event far in future (e.g. 500 days) has no caught-up milestones
      const farProfile: EventProfile = {
        ...baseWeddingProfile,
        eventDate: addDays(TODAY, 500),
      };
      const budget = computeBudget(farProfile, indiaLocalePack);
      const timeline = computeTimeline(farProfile, indiaLocalePack, TODAY);
      const flags = computeFlags(farProfile, budget, timeline, indiaLocalePack);

      expect(flags.some((f) => f.code === 'catch_up_needed')).toBe(false);
    });
  });
});
