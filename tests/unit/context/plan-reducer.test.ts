import { describe, it, expect } from 'vitest';
import { planReducer, initialPlanState, PlanState } from '@/context/plan-context';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('Plan Reducer State & Actions (src/context/plan-context.tsx)', () => {
  const today = '2026-10-29';

  it('hydrates profile and overrides into state', () => {
    const next = planReducer(initialPlanState, {
      type: 'HYDRATE',
      profile: weddingPuneFixture,
      overrides: { catering: 1200000 },
    });

    expect(next.realProfile?.cityName).toBe('Pune');
    expect(next.realOverrides['catering']).toBe(1200000);
    expect(next.isHydrated).toBe(true);
    expect(next.isSampleMode).toBe(false);
  });

  it('sets profile and resets sample mode', () => {
    const sampleState: PlanState = {
      ...initialPlanState,
      isSampleMode: true,
      sampleProfile: weddingPuneFixture,
    };

    const next = planReducer(sampleState, {
      type: 'SET_PROFILE',
      profile: { ...weddingPuneFixture, cityName: 'Delhi' },
    });

    expect(next.isSampleMode).toBe(false);
    expect(next.sampleProfile).toBeNull();
    expect(next.realProfile?.cityName).toBe('Delhi');
  });

  it('applies patches to realProfile when not in sample mode', () => {
    const baseState: PlanState = {
      ...initialPlanState,
      realProfile: weddingPuneFixture,
    };

    const next = planReducer(baseState, {
      type: 'APPLY_PATCH',
      patch: { guestCount: 250 },
      today,
    });

    expect(next.realProfile?.guestCount).toBe(250);

    const nextReduced = planReducer(baseState, {
      type: 'APPLY_PATCH',
      patch: { guestCount: 150 },
      today,
    });
    expect(nextReduced.realProfile?.guestCount).toBe(150);
  });

  it('sets and clears overrides', () => {
    let state = planReducer(initialPlanState, {
      type: 'SET_OVERRIDE',
      categoryId: 'decor',
      amount: 450000.4,
    });

    expect(state.realOverrides['decor']).toBe(450000);

    state = planReducer(state, {
      type: 'CLEAR_OVERRIDE',
      categoryId: 'decor',
    });

    expect(state.realOverrides['decor']).toBeUndefined();
  });

  it('toggles milestones in real and sample modes with clearProgress', () => {
    // 1. Real mode toggling
    let state = planReducer(initialPlanState, {
      type: 'TOGGLE_MILESTONE',
      id: 'wedding_venue_photo',
    });
    expect(state.realCompletedMilestones).toEqual(['wedding_venue_photo']);

    // Toggle again to remove
    state = planReducer(state, {
      type: 'TOGGLE_MILESTONE',
      id: 'wedding_venue_photo',
    });
    expect(state.realCompletedMilestones).toEqual([]);

    // 2. Vendor toggling
    state = planReducer(state, {
      type: 'TOGGLE_VENDOR',
      id: 'book_lawn_venue',
    });
    expect(state.realBookedVendors).toEqual(['book_lawn_venue']);

    // 3. Clear progress
    state = planReducer(state, { type: 'CLEAR_PROGRESS' });
    expect(state.realBookedVendors).toEqual([]);
    expect(state.realCompletedMilestones).toEqual([]);

    // 4. Sample mode isolation: toggling in sample mode leaves real progress untouched
    const sampleState: PlanState = {
      ...initialPlanState,
      realCompletedMilestones: ['real_m1'],
      realBookedVendors: ['real_v1'],
      isSampleMode: true,
      sampleProfile: weddingPuneFixture,
      sampleCompletedMilestones: [],
      sampleBookedVendors: [],
    };

    const nextSample = planReducer(sampleState, {
      type: 'TOGGLE_MILESTONE',
      id: 'sample_m1',
    });
    expect(nextSample.sampleCompletedMilestones).toEqual(['sample_m1']);
    expect(nextSample.realCompletedMilestones).toEqual(['real_m1']);
  });

  describe('Sample Mode Isolation (Amendment 1)', () => {
    it('loading sample mode does NOT overwrite existing real profile', () => {
      const realSavedState: PlanState = {
        ...initialPlanState,
        realProfile: { ...weddingPuneFixture, cityName: 'Bengaluru', guestCount: 350 },
        realOverrides: { decor: 500000 },
        isSampleMode: false,
      };

      const next = planReducer(realSavedState, {
        type: 'LOAD_SAMPLE',
        kind: 'wedding',
        today,
      });

      expect(next.isSampleMode).toBe(true);
      expect(next.sampleProfile).not.toBeNull();
      // Real profile must remain strictly intact
      expect(next.realProfile?.cityName).toBe('Bengaluru');
      expect(next.realProfile?.guestCount).toBe(350);
      expect(next.realOverrides['decor']).toBe(500000);
    });

    it('modifying overrides or patching in sample mode leaves real profile and overrides untouched', () => {
      const realSavedState: PlanState = {
        ...initialPlanState,
        realProfile: { ...weddingPuneFixture, cityName: 'Bengaluru', guestCount: 350 },
        realOverrides: { decor: 500000 },
        isSampleMode: true,
        sampleProfile: weddingPuneFixture,
        sampleOverrides: {},
      };

      // Set override in sample mode
      const stateWithOverride = planReducer(realSavedState, {
        type: 'SET_OVERRIDE',
        categoryId: 'catering',
        amount: 800000,
      });

      expect(stateWithOverride.sampleOverrides['catering']).toBe(800000);
      expect(stateWithOverride.realOverrides['catering']).toBeUndefined();
      expect(stateWithOverride.realOverrides['decor']).toBe(500000);

      // Apply patch in sample mode
      const stateWithPatch = planReducer(stateWithOverride, {
        type: 'APPLY_PATCH',
        patch: {
          guestCount: 50,
          dietary: { veg: 40, nonVeg: 10, jain: 0, vegan: 0 },
        },
        today,
      });

      expect(stateWithPatch.sampleProfile?.guestCount).toBe(50);
      expect(stateWithPatch.realProfile?.guestCount).toBe(350);
    });

    it('exiting sample mode cleanly restores real plan view', () => {
      const inSampleState: PlanState = {
        ...initialPlanState,
        realProfile: { ...weddingPuneFixture, cityName: 'Jaipur', guestCount: 180 },
        realOverrides: { decor: 250000 },
        isSampleMode: true,
        sampleProfile: weddingPuneFixture,
        sampleOverrides: { catering: 999999 },
      };

      const exited = planReducer(inSampleState, {
        type: 'EXIT_SAMPLE',
      });

      expect(exited.isSampleMode).toBe(false);
      expect(exited.sampleProfile).toBeNull();
      expect(exited.realProfile?.cityName).toBe('Jaipur');
      expect(exited.realProfile?.guestCount).toBe(180);
      expect(exited.realOverrides['decor']).toBe(250000);
    });
  });

  it('resets state completely on RESET', () => {
    const filledState: PlanState = {
      ...initialPlanState,
      realProfile: weddingPuneFixture,
      realOverrides: { decor: 500000 },
      isSampleMode: true,
      sampleProfile: weddingPuneFixture,
    };

    const resetState = planReducer(filledState, { type: 'RESET' });
    expect(resetState.realProfile).toBeNull();
    expect(resetState.sampleProfile).toBeNull();
    expect(resetState.realOverrides).toEqual({});
    expect(resetState.isSampleMode).toBe(false);
  });
});
