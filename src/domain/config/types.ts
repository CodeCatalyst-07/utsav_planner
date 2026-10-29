import { EventType, CityTier, BudgetTier, VenueType } from '../schemas/profile';

export type AssumptionSource = 'assumption';

export interface BudgetSplitCategory {
  id: string;
  label: string;
  weight: number; // percentage integer, sums to 100 per event type
  source: AssumptionSource;
}

export interface CateringBand {
  min: number;
  max: number;
  source: AssumptionSource;
}

export type CityCateringBands = Record<BudgetTier, CateringBand>;
export type CateringBandsByCityTier = Record<CityTier, CityCateringBands>;

export interface MilestoneDefinition {
  id: string;
  title: string;
  detail: string;
  offset: number; // days before event; negative = days after event
  category: string;
  critical: boolean;
  verifyNote?: string;
  source: AssumptionSource;
}

export type PriorityLevel = 'high' | 'medium' | 'low';

export interface VendorChecklistTemplate {
  id: string;
  label: string;
  budgetCategory: string;
  priority: PriorityLevel;
  leadDays: number;
  mapsQueryTemplate: string; // e.g. "{label} in {cityName}"
  source: AssumptionSource;
}

export interface ConditionalChecklistRule {
  id: string;
  condition:
    | 'destination_venue'
    | 'monsoon_outdoor'
    | 'jain_dietary'
    | 'vegan_dietary'
    | 'kids_birthday_safety'
    | 'multi_function_wedding';
  item: VendorChecklistTemplate;
  note?: string;
}

export interface LocalePack {
  locale: string;
  countryName: string;
  currency: string;
  contingencyFloorPercent: number;
  minLeadDays: Record<EventType, number>;
  budgetSplits: Record<EventType, BudgetSplitCategory[]>;
  cateringBands: CateringBandsByCityTier;
  communityFestivalCateringBand: CateringBand;
  cateringEventTypeMultipliers: {
    weddingBase: number;
    weddingSubsequentFunctionMultiplier: number;
    birthdayAdult: number;
    birthdayKids: number;
  };
  seasonRules: {
    weddingPeakMonths: number[]; // e.g. [11, 12, 1, 2]
    weddingPeakFactor: number; // 1.15
    monsoonMonths: number[]; // [6, 7, 8, 9]
    outdoorVenues: VenueType[]; // ['lawn', 'destination', 'community_hall']
  };
  perHeadThresholds: {
    weddingMinBudgetPerHead: number;
    birthdayMinBudgetPerHead: number;
    communityFestivalMinBudgetPerHead: number;
  };
  milestones: Record<EventType, MilestoneDefinition[]>;
  vendorChecklists: Record<EventType, VendorChecklistTemplate[]>;
  conditionalRules: ConditionalChecklistRule[];
}
