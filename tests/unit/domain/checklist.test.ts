import { describe, it, expect } from 'vitest';
import { computeChecklist, resolveMapsQuery } from '@/domain/rules/checklist';
import { indiaLocalePack } from '@/domain/config/in';
import { EventProfile } from '@/domain/schemas/profile';

describe('Checklist Engine (src/domain/rules/checklist.ts)', () => {
  const TODAY = '2026-10-29';

  const baseWeddingProfile: EventProfile = {
    eventType: 'wedding',
    eventDate: '2027-10-29',
    cityTier: 'tier1',
    cityName: 'Pune',
    guestCount: 300,
    totalBudgetInr: 2_500_000,
    budgetTier: 'mid',
    venueType: 'banquet',
    functionsCount: 1,
    dietary: { veg: 300, nonVeg: 0, jain: 0, vegan: 0 },
    toggles: { venueIncluded: false, includeAttireJewellery: true },
    overrides: {},
    notes: undefined,
  };

  it('populates standard wedding vendor checklist items', () => {
    const result = computeChecklist(baseWeddingProfile, indiaLocalePack, TODAY);
    expect(result.items.length).toBeGreaterThanOrEqual(15);

    const venueItem = result.items.find((i) => i.id === 'venue');
    expect(venueItem).toBeDefined();
    expect(venueItem?.priority).toBe('high');
    expect(venueItem?.mapsQuery).toContain('Pune');
  });

  it('triggers destination_venue conditional item when venueType is destination', () => {
    const destProfile: EventProfile = {
      ...baseWeddingProfile,
      venueType: 'destination',
    };

    const result = computeChecklist(destProfile, indiaLocalePack, TODAY);
    const travelItem = result.items.find((i) => i.id === 'travel_stay');
    expect(travelItem).toBeDefined();
    expect(travelItem?.isConditional).toBe(true);
    expect(travelItem?.priority).toBe('high');
  });

  it('triggers monsoon_outdoor conditional item when outdoor venue is in monsoon months', () => {
    const monsoonProfile: EventProfile = {
      ...baseWeddingProfile,
      venueType: 'lawn',
      eventDate: '2027-07-15', // July is in monsoon months [6, 7, 8, 9]
    };

    const result = computeChecklist(monsoonProfile, indiaLocalePack, TODAY);
    const tentItem = result.items.find((i) => i.id === 'backup_tent');
    expect(tentItem).toBeDefined();
    expect(tentItem?.isConditional).toBe(true);
  });

  it('triggers jain and vegan dietary catering checklist items', () => {
    const dietaryProfile: EventProfile = {
      ...baseWeddingProfile,
      dietary: { veg: 200, nonVeg: 50, jain: 30, vegan: 20 },
    };

    const result = computeChecklist(dietaryProfile, indiaLocalePack, TODAY);
    const jainItem = result.items.find((i) => i.id === 'jain_kitchen_setup');
    const veganItem = result.items.find((i) => i.id === 'vegan_dairy_free');

    expect(jainItem).toBeDefined();
    expect(veganItem).toBeDefined();
  });

  it('triggers multi_function_flow item when wedding functionsCount > 1', () => {
    const multiFunctionProfile: EventProfile = {
      ...baseWeddingProfile,
      functionsCount: 3,
    };

    const result = computeChecklist(multiFunctionProfile, indiaLocalePack, TODAY);
    const runOfShowItem = result.items.find((i) => i.id === 'multi_function_flow');
    expect(runOfShowItem).toBeDefined();
  });

  it('ensures safety_first_aid is always high priority for kids birthdays', () => {
    const kidsProfile: EventProfile = {
      eventType: 'birthday_kids',
      eventDate: '2026-12-15',
      cityTier: 'tier2',
      cityName: 'Indore',
      guestCount: 40,
      totalBudgetInr: 60_000,
      budgetTier: 'mid',
      venueType: 'home',
      functionsCount: 1,
      dietary: { veg: 40, nonVeg: 0, jain: 0, vegan: 0 },
      toggles: { venueIncluded: true, includeAttireJewellery: false },
      overrides: {},
      notes: undefined,
    };

    const result = computeChecklist(kidsProfile, indiaLocalePack, TODAY);
    const safetyItem = result.items.find((i) => i.id === 'safety_first_aid');
    expect(safetyItem).toBeDefined();
    expect(safetyItem?.priority).toBe('high');
  });

  it('clamps due dates that precede today to today', () => {
    // Event in 10 days, but venue lead time is 330 days
    const urgentProfile: EventProfile = {
      ...baseWeddingProfile,
      eventDate: '2026-11-08',
    };

    const result = computeChecklist(urgentProfile, indiaLocalePack, TODAY);
    const venueItem = result.items.find((i) => i.id === 'venue');
    expect(venueItem).toBeDefined();
    expect(venueItem?.dueDate).toBe(TODAY);
  });

  it('resolves maps query templates with city name fallback to tier label', () => {
    const queryWithCity = resolveMapsQuery(
      '{label} in {cityName}',
      'Wedding Caterers',
      'Jaipur',
      'tier2'
    );
    expect(queryWithCity).toBe('Wedding Caterers in Jaipur');

    const queryWithFallback = resolveMapsQuery(
      '{label} in {cityName}',
      'Wedding Caterers',
      undefined,
      'tier1'
    );
    expect(queryWithFallback).toBe('Wedding Caterers in TIER1');
  });
});
