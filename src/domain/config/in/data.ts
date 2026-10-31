/**
 * ============================================================================
 * INDIA LOCALE PACK (Data & Presets)
 * ============================================================================
 * DISCLAIMER:
 * All figures, per-plate price bands, percentage splits, and milestone offsets
 * below are blog-derived heuristic placeholders. They are fully editable and
 * represent planning assumptions, NOT commercial vendor quotes or guarantees.
 * ============================================================================
 */

import { LocalePack } from '../types';
import { budgetSplits } from './budgetSplits';
import {
  cateringBands,
  communityFestivalCateringBand,
  cateringEventTypeMultipliers,
  seasonRules,
  perHeadThresholds,
} from './cateringBands';
import { milestones } from './milestones';
import { vendorChecklists } from './checklists';
import { conditionalRules } from './conditionals';

export {
  budgetSplits,
  cateringBands,
  communityFestivalCateringBand,
  cateringEventTypeMultipliers,
  seasonRules,
  perHeadThresholds,
  milestones,
  vendorChecklists,
  conditionalRules,
};

export const indiaLocaleData: LocalePack = {
  locale: 'in',
  countryName: 'India',
  currency: 'INR',
  contingencyFloorPercent: 5,

  minLeadDays: {
    wedding: 180,
    birthday_kids: 28,
    birthday_adult: 56,
    community_festival: 70,
  },

  budgetSplits,
  cateringBands,
  communityFestivalCateringBand,
  cateringEventTypeMultipliers,
  seasonRules,
  perHeadThresholds,
  milestones,
  vendorChecklists,
  conditionalRules,
};
