import { EventProfile, validateProfile, scaleDietary, Dietary } from '@/domain/schemas/profile';
import { buildSampleProfile, SampleProfileKind } from '@/domain/fixtures/profiles';

export interface PlanState {
  realProfile: EventProfile | null;
  realOverrides: Record<string, number>;
  realCompletedMilestones: string[];
  realBookedVendors: string[];
  isSampleMode: boolean;
  sampleProfile: EventProfile | null;
  sampleOverrides: Record<string, number>;
  sampleCompletedMilestones: string[];
  sampleBookedVendors: string[];
  isHydrated: boolean;
}

export type PlanAction =
  | {
      type: 'HYDRATE';
      profile: EventProfile;
      overrides: Record<string, number>;
      completedMilestones?: string[];
      bookedVendors?: string[];
    }
  | { type: 'SET_HYDRATED' }
  | { type: 'SET_PROFILE'; profile: EventProfile }
  | { type: 'APPLY_PATCH'; patch: Record<string, unknown>; today: string }
  | { type: 'SET_OVERRIDE'; categoryId: string; amount: number }
  | { type: 'CLEAR_OVERRIDE'; categoryId: string }
  | { type: 'TOGGLE_MILESTONE'; id: string }
  | { type: 'TOGGLE_VENDOR'; id: string }
  | { type: 'CLEAR_PROGRESS' }
  | { type: 'LOAD_SAMPLE'; kind: SampleProfileKind; today: string }
  | { type: 'EXIT_SAMPLE' }
  | { type: 'RESET' };

export const initialPlanState: PlanState = {
  realProfile: null,
  realOverrides: {},
  realCompletedMilestones: [],
  realBookedVendors: [],
  isSampleMode: false,
  sampleProfile: null,
  sampleOverrides: {},
  sampleCompletedMilestones: [],
  sampleBookedVendors: [],
  isHydrated: false,
};

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        realProfile: action.profile,
        realOverrides: action.overrides,
        realCompletedMilestones: action.completedMilestones || [],
        realBookedVendors: action.bookedVendors || [],
        isHydrated: true,
      };

    case 'SET_HYDRATED':
      return {
        ...state,
        isHydrated: true,
      };

    case 'SET_PROFILE':
      return {
        ...state,
        realProfile: action.profile,
        realOverrides: action.profile.overrides || {},
        realCompletedMilestones: [],
        realBookedVendors: [],
        isSampleMode: false,
        sampleProfile: null,
        sampleOverrides: {},
        sampleCompletedMilestones: [],
        sampleBookedVendors: [],
      };

    case 'APPLY_PATCH': {
      const activeProfile = state.isSampleMode ? state.sampleProfile : state.realProfile;
      if (!activeProfile) return state;

      let dietary = {
        ...activeProfile.dietary,
        ...(action.patch.dietary && typeof action.patch.dietary === 'object'
          ? (action.patch.dietary as Record<string, number>)
          : {}),
      };

      if (typeof action.patch.guestCount === 'number' && !action.patch.dietary) {
        dietary = scaleDietary(dietary as Dietary, action.patch.guestCount);
      }

      const merged = {
        ...activeProfile,
        ...action.patch,
        dietary,
        toggles: {
          ...activeProfile.toggles,
          ...(action.patch.toggles && typeof action.patch.toggles === 'object'
            ? (action.patch.toggles as Record<string, boolean>)
            : {}),
        },
      };

      const val = validateProfile(merged, action.today);
      if (val.ok) {
        if (state.isSampleMode) {
          return { ...state, sampleProfile: val.data };
        }
        return { ...state, realProfile: val.data };
      }
      return state;
    }

    case 'SET_OVERRIDE': {
      if (state.isSampleMode) {
        return {
          ...state,
          sampleOverrides: {
            ...state.sampleOverrides,
            [action.categoryId]: Math.max(0, Math.round(action.amount)),
          },
        };
      }
      return {
        ...state,
        realOverrides: {
          ...state.realOverrides,
          [action.categoryId]: Math.max(0, Math.round(action.amount)),
        },
      };
    }

    case 'CLEAR_OVERRIDE': {
      if (state.isSampleMode) {
        const next = { ...state.sampleOverrides };
        delete next[action.categoryId];
        return { ...state, sampleOverrides: next };
      }
      const next = { ...state.realOverrides };
      delete next[action.categoryId];
      return { ...state, realOverrides: next };
    }

    case 'TOGGLE_MILESTONE': {
      if (state.isSampleMode) {
        const next = new Set(state.sampleCompletedMilestones);
        if (next.has(action.id)) next.delete(action.id);
        else next.add(action.id);
        return { ...state, sampleCompletedMilestones: Array.from(next) };
      }
      const next = new Set(state.realCompletedMilestones);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, realCompletedMilestones: Array.from(next) };
    }

    case 'TOGGLE_VENDOR': {
      if (state.isSampleMode) {
        const next = new Set(state.sampleBookedVendors);
        if (next.has(action.id)) next.delete(action.id);
        else next.add(action.id);
        return { ...state, sampleBookedVendors: Array.from(next) };
      }
      const next = new Set(state.realBookedVendors);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, realBookedVendors: Array.from(next) };
    }

    case 'CLEAR_PROGRESS': {
      if (state.isSampleMode) {
        return { ...state, sampleCompletedMilestones: [], sampleBookedVendors: [] };
      }
      return { ...state, realCompletedMilestones: [], realBookedVendors: [] };
    }

    case 'LOAD_SAMPLE': {
      const sample = buildSampleProfile(action.kind, action.today);
      return {
        ...state,
        isSampleMode: true,
        sampleProfile: sample,
        sampleOverrides: {},
        sampleCompletedMilestones: [],
        sampleBookedVendors: [],
      };
    }

    case 'EXIT_SAMPLE':
      return {
        ...state,
        isSampleMode: false,
        sampleProfile: null,
        sampleOverrides: {},
        sampleCompletedMilestones: [],
        sampleBookedVendors: [],
      };

    case 'RESET':
      return {
        ...state,
        realProfile: null,
        realOverrides: {},
        realCompletedMilestones: [],
        realBookedVendors: [],
        isSampleMode: false,
        sampleProfile: null,
        sampleOverrides: {},
        sampleCompletedMilestones: [],
        sampleBookedVendors: [],
      };

    default:
      return state;
  }
}
