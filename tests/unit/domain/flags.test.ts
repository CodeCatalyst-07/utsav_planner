import { describe, it, expect } from 'vitest';
import { computeFlags } from '@/domain/rules/flags';
import { computeBudget } from '@/domain/rules/budget';
import { computeTimeline } from '@/domain/rules/timeline';
import { indiaLocalePack } from '@/domain/config/in';
import { EventProfile } from '@/domain/schemas/profile';

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

  it('raises wedding_muhurat_verify advisory for wedding profiles', () => {
    const budget = computeBudget(baseWeddingProfile, indiaLocalePack);
    const timeline = computeTimeline(baseWeddingProfile, indiaLocalePack, TODAY);
    const flags = computeFlags(baseWeddingProfile, budget, timeline, indiaLocalePack);

    const muhuratFlag = flags.find((f) => f.code === 'wedding_muhurat_verify');
    expect(muhuratFlag).toBeDefined();
    expect(muhuratFlag?.severity).toBe('info');
  });

  it('raises peak_season flag when wedding falls in Nov-Feb peak season', () => {
    const budget = computeBudget(baseWeddingProfile, indiaLocalePack);
    const timeline = computeTimeline(baseWeddingProfile, indiaLocalePack, TODAY);
    const flags = computeFlags(baseWeddingProfile, budget, timeline, indiaLocalePack);

    const peakFlag = flags.find((f) => f.code === 'peak_season');
    expect(peakFlag).toBeDefined();
    expect(peakFlag?.severity).toBe('info');
  });

  it('raises compressed_plan warning when lead time is under minimum', () => {
    const compressedProfile: EventProfile = {
      ...baseWeddingProfile,
      eventDate: '2026-12-15', // < 180 days away
    };

    const budget = computeBudget(compressedProfile, indiaLocalePack);
    const timeline = computeTimeline(compressedProfile, indiaLocalePack, TODAY);
    const flags = computeFlags(compressedProfile, budget, timeline, indiaLocalePack);

    const compFlag = flags.find((f) => f.code === 'compressed_plan');
    expect(compFlag).toBeDefined();
    expect(['warning', 'critical']).toContain(compFlag?.severity);
  });

  it('raises monsoon_outdoor warning for lawn/destination during monsoon', () => {
    const monsoonProfile: EventProfile = {
      ...baseWeddingProfile,
      eventDate: '2027-07-20',
      venueType: 'lawn',
    };

    const budget = computeBudget(monsoonProfile, indiaLocalePack);
    const timeline = computeTimeline(monsoonProfile, indiaLocalePack, TODAY);
    const flags = computeFlags(monsoonProfile, budget, timeline, indiaLocalePack);

    const monsoonFlag = flags.find((f) => f.code === 'monsoon_outdoor');
    expect(monsoonFlag).toBeDefined();
    expect(monsoonFlag?.severity).toBe('warning');
  });

  it('raises catering_over critical flag when catering budget is severely deficient', () => {
    const underfundedProfile: EventProfile = {
      ...baseWeddingProfile,
      totalBudgetInr: 300_000,
      guestCount: 500,
    };

    const budget = computeBudget(underfundedProfile, indiaLocalePack);
    const timeline = computeTimeline(underfundedProfile, indiaLocalePack, TODAY);
    const flags = computeFlags(underfundedProfile, budget, timeline, indiaLocalePack);

    const cateringFlag = flags.find((f) => f.code === 'catering_over');
    expect(cateringFlag).toBeDefined();
    expect(cateringFlag?.severity).toBe('critical');
  });

  it('raises community_permissions_verify for community festivals', () => {
    const festivalProfile: EventProfile = {
      ...baseWeddingProfile,
      eventType: 'community_festival',
      totalBudgetInr: 400_000,
      guestCount: 500,
      eventDate: '2027-09-14',
    };

    const budget = computeBudget(festivalProfile, indiaLocalePack);
    const timeline = computeTimeline(festivalProfile, indiaLocalePack, TODAY);
    const flags = computeFlags(festivalProfile, budget, timeline, indiaLocalePack);

    const permFlag = flags.find((f) => f.code === 'community_permissions_verify');
    expect(permFlag).toBeDefined();
    expect(permFlag?.severity).toBe('info');
  });

  it('raises per_head_budget_low when budget per guest is below threshold', () => {
    const lowPerHeadProfile: EventProfile = {
      ...baseWeddingProfile,
      guestCount: 2000,
      totalBudgetInr: 100_000, // ₹50/head < ₹2500 wedding threshold
    };

    const budget = computeBudget(lowPerHeadProfile, indiaLocalePack);
    const timeline = computeTimeline(lowPerHeadProfile, indiaLocalePack, TODAY);
    const flags = computeFlags(lowPerHeadProfile, budget, timeline, indiaLocalePack);

    const perHeadFlag = flags.find((f) => f.code === 'per_head_budget_low');
    expect(perHeadFlag).toBeDefined();
    expect(perHeadFlag?.severity).toBe('warning');
  });

  it('raises contingency_below_floor when user override forces contingency below 5%', () => {
    const lowContingencyProfile: EventProfile = {
      ...baseWeddingProfile,
      overrides: {
        contingency: 1000, // < 5% of ₹25L (which is ₹1.25L)
      },
    };

    const budget = computeBudget(lowContingencyProfile, indiaLocalePack);
    const timeline = computeTimeline(lowContingencyProfile, indiaLocalePack, TODAY);
    const flags = computeFlags(lowContingencyProfile, budget, timeline, indiaLocalePack);

    const contingencyFlag = flags.find((f) => f.code === 'contingency_below_floor');
    expect(contingencyFlag).toBeDefined();
    expect(contingencyFlag?.severity).toBe('warning');
  });
});
