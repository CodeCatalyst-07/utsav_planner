import { CityTier, VenueType } from '@/domain/schemas/profile';
import { CateringBand } from '../types';

export const cateringBands: Record<CityTier, Record<'budget' | 'mid' | 'premium', CateringBand>> = {
  tier1: {
    budget: { min: 700, max: 1200, source: 'assumption' },
    mid: { min: 1200, max: 2500, source: 'assumption' },
    premium: { min: 2500, max: 5000, source: 'assumption' },
  },
  tier2: {
    budget: { min: 500, max: 900, source: 'assumption' },
    mid: { min: 900, max: 1800, source: 'assumption' },
    premium: { min: 1800, max: 3500, source: 'assumption' },
  },
  tier3: {
    budget: { min: 350, max: 700, source: 'assumption' },
    mid: { min: 700, max: 1300, source: 'assumption' },
    premium: { min: 1300, max: 2500, source: 'assumption' },
  },
};

export const communityFestivalCateringBand: CateringBand = {
  min: 50,
  max: 150,
  source: 'assumption',
};

export const cateringEventTypeMultipliers = {
  weddingBase: 1.0,
  weddingSubsequentFunctionMultiplier: 0.6,
  birthdayAdult: 0.8,
  birthdayKids: 0.5,
};

export const seasonRules: {
  weddingPeakMonths: number[];
  weddingPeakFactor: number;
  monsoonMonths: number[];
  outdoorVenues: VenueType[];
} = {
  weddingPeakMonths: [11, 12, 1, 2], // Nov, Dec, Jan, Feb
  weddingPeakFactor: 1.15,
  monsoonMonths: [6, 7, 8, 9], // Jun, Jul, Aug, Sep
  outdoorVenues: ['lawn', 'destination', 'community_hall'],
};

export const perHeadThresholds = {
  weddingMinBudgetPerHead: 2500,
  birthdayMinBudgetPerHead: 500,
  communityFestivalMinBudgetPerHead: 200,
};
