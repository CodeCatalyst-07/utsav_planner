'use client';

import '@/lib/zod-config';
import React, { createContext, useContext, useReducer, useEffect, useMemo, ReactNode } from 'react';
import { EventProfile, validateProfile } from '@/domain/schemas/profile';
import { BasePlan, buildPlan } from '@/domain/rules/plan';
import { SampleProfileKind } from '@/domain/fixtures/profiles';
import { indiaLocalePack } from '@/domain/config/in';
import { getTodayInIst } from '@/lib/today';
import { PlanState, PlanAction, initialPlanState, planReducer } from './plan-reducer';

export { type PlanState, type PlanAction, initialPlanState, planReducer };

export const STORAGE_KEY = 'utsav_plan_v2';
export const LEGACY_STORAGE_KEY_V1 = 'utsav_plan_v1';

export interface PlanContextValue {
  profile: EventProfile | null;
  overrides: Record<string, number>;
  plan: BasePlan | null;
  completedMilestones: string[];
  bookedVendors: string[];
  isHydrated: boolean;
  isSampleMode: boolean;
  hasRealPlan: boolean;
  today: string;
  setProfile: (profile: EventProfile) => void;
  applyPatch: (patch: Record<string, unknown>) => void;
  setOverride: (categoryId: string, amount: number) => void;
  clearOverride: (categoryId: string) => void;
  toggleMilestone: (id: string) => void;
  toggleVendor: (id: string) => void;
  clearProgress: () => void;
  loadSample: (kind?: SampleProfileKind) => void;
  exitSample: () => void;
  reset: () => void;
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export function PlanProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData?: Partial<PlanState>;
}) {
  const [state, dispatch] = useReducer(planReducer, {
    ...initialPlanState,
    ...initialData,
  });

  const today = useMemo(() => getTodayInIst(), []);

  // SSR-safe hydration from localStorage with v1 -> v2 migration
  useEffect(() => {
    try {
      // 1. Try reading v2
      const storedV2 = localStorage.getItem(STORAGE_KEY);
      if (storedV2) {
        const parsed = JSON.parse(storedV2);
        if (parsed && parsed.version === 2 && parsed.profile) {
          const val = validateProfile(parsed.profile, today);
          if (val.ok) {
            const completedMilestones = Array.isArray(parsed.completedMilestones)
              ? parsed.completedMilestones.filter((id: unknown) => typeof id === 'string')
              : [];
            const bookedVendors = Array.isArray(parsed.bookedVendors)
              ? parsed.bookedVendors.filter((id: unknown) => typeof id === 'string')
              : [];
            dispatch({
              type: 'HYDRATE',
              profile: val.data,
              overrides: parsed.overrides || val.data.overrides || {},
              completedMilestones,
              bookedVendors,
            });
            return;
          }
        }
        localStorage.removeItem(STORAGE_KEY);
      }

      // 2. Migration from v1
      const storedV1 = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
      if (storedV1) {
        const parsedV1 = JSON.parse(storedV1);
        if (parsedV1 && parsedV1.version === 1 && parsedV1.profile) {
          const val = validateProfile(parsedV1.profile, today);
          if (val.ok) {
            const overrides = parsedV1.overrides || val.data.overrides || {};
            dispatch({
              type: 'HYDRATE',
              profile: val.data,
              overrides,
              completedMilestones: [],
              bookedVendors: [],
            });
            // Persist migrated v2 and remove legacy v1
            const v2Payload = {
              version: 2,
              profile: val.data,
              overrides,
              completedMilestones: [],
              bookedVendors: [],
              savedAt: new Date().toISOString(),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Payload));
            localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
            return;
          }
        }
        localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
      }
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
      } catch {
        // ignore
      }
    } finally {
      dispatch({ type: 'SET_HYDRATED' });
    }
  }, [today]);

  // Persist real plan changes ONLY (sample plan is NEVER written to localStorage)
  useEffect(() => {
    if (!state.isHydrated) return;

    try {
      if (state.realProfile) {
        const payload = {
          version: 2,
          profile: state.realProfile,
          overrides: state.realOverrides,
          completedMilestones: state.realCompletedMilestones,
          bookedVendors: state.realBookedVendors,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('Unable to persist plan to localStorage', err);
    }
  }, [
    state.realProfile,
    state.realOverrides,
    state.realCompletedMilestones,
    state.realBookedVendors,
    state.isHydrated,
  ]);

  // Active profile, overrides, and progress based on mode
  const activeProfile = state.isSampleMode ? state.sampleProfile : state.realProfile;
  const activeOverrides = state.isSampleMode ? state.sampleOverrides : state.realOverrides;
  const activeCompletedMilestones = state.isSampleMode
    ? state.sampleCompletedMilestones
    : state.realCompletedMilestones;
  const activeBookedVendors = state.isSampleMode
    ? state.sampleBookedVendors
    : state.realBookedVendors;

  // Pure deterministic derived plan with ZERO network calls
  const derivedPlan = useMemo(() => {
    if (!activeProfile) return null;
    const merged: EventProfile = {
      ...activeProfile,
      overrides: {
        ...activeProfile.overrides,
        ...activeOverrides,
      },
    };
    return buildPlan(merged, today, indiaLocalePack);
  }, [activeProfile, activeOverrides, today]);

  const value: PlanContextValue = useMemo(
    () => ({
      profile: activeProfile,
      overrides: activeOverrides,
      plan: derivedPlan,
      completedMilestones: activeCompletedMilestones,
      bookedVendors: activeBookedVendors,
      isHydrated: state.isHydrated,
      isSampleMode: state.isSampleMode,
      hasRealPlan: Boolean(state.realProfile),
      today,
      setProfile: (profile: EventProfile) => dispatch({ type: 'SET_PROFILE', profile }),
      applyPatch: (patch: Record<string, unknown>) =>
        dispatch({ type: 'APPLY_PATCH', patch, today }),
      setOverride: (categoryId: string, amount: number) =>
        dispatch({ type: 'SET_OVERRIDE', categoryId, amount }),
      clearOverride: (categoryId: string) => dispatch({ type: 'CLEAR_OVERRIDE', categoryId }),
      toggleMilestone: (id: string) => dispatch({ type: 'TOGGLE_MILESTONE', id }),
      toggleVendor: (id: string) => dispatch({ type: 'TOGGLE_VENDOR', id }),
      clearProgress: () => dispatch({ type: 'CLEAR_PROGRESS' }),
      loadSample: (kind: SampleProfileKind = 'wedding') =>
        dispatch({ type: 'LOAD_SAMPLE', kind, today }),
      exitSample: () => dispatch({ type: 'EXIT_SAMPLE' }),
      reset: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
        } catch {
          // ignore
        }
        dispatch({ type: 'RESET' });
      },
    }),
    [
      activeProfile,
      activeOverrides,
      derivedPlan,
      activeCompletedMilestones,
      activeBookedVendors,
      state.isHydrated,
      state.isSampleMode,
      state.realProfile,
      today,
    ]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlan must be used within a PlanProvider');
  }
  return context;
}
