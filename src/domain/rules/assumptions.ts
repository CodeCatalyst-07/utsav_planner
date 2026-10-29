import { EventProfile } from '../schemas/profile';
import { LocalePack } from '../config/types';
import { calculateSeasonFactor } from './budget';
import { formatInr } from '../money/inr';

export interface AssumptionItem {
  id: string;
  label: string;
  value: string;
  source: 'user' | 'assumption';
  editable: boolean;
}

export function computeAssumptions(profile: EventProfile, pack: LocalePack): AssumptionItem[] {
  const seasonFactor = calculateSeasonFactor(profile.eventDate, profile.eventType, pack);

  let perPlateDisplay = 'Custom';
  if (profile.eventType === 'community_festival') {
    perPlateDisplay = `${formatInr(pack.communityFestivalCateringBand.min)} - ${formatInr(pack.communityFestivalCateringBand.max)}`;
  } else {
    const band = pack.cateringBands[profile.cityTier]?.[profile.budgetTier];
    if (band) {
      perPlateDisplay = `${formatInr(band.min)} - ${formatInr(band.max)}`;
    }
  }

  const items: AssumptionItem[] = [
    {
      id: 'guest_count',
      label: 'Guest Count',
      value: `${profile.guestCount} guests`,
      source: 'user',
      editable: true,
    },
    {
      id: 'city_tier',
      label: 'City Tier',
      value: profile.cityTier.toUpperCase(),
      source: 'user',
      editable: true,
    },
    {
      id: 'budget_tier',
      label: 'Budget Quality Tier',
      value: profile.budgetTier.toUpperCase(),
      source: 'user',
      editable: true,
    },
    {
      id: 'venue_type',
      label: 'Venue Style',
      value: profile.venueType,
      source: 'user',
      editable: true,
    },
    {
      id: 'per_plate_band',
      label: 'Estimated Catering Cost Band (Per Plate)',
      value: perPlateDisplay,
      source: 'assumption',
      editable: true,
    },
    {
      id: 'season_factor',
      label: 'Peak Season Demand Multiplier',
      value: `${seasonFactor}x`,
      source: 'assumption',
      editable: false,
    },
    {
      id: 'contingency_floor',
      label: 'Safety Contingency Floor',
      value: `${pack.contingencyFloorPercent}% of total budget`,
      source: 'assumption',
      editable: false,
    },
  ];

  if (profile.eventType === 'wedding') {
    items.push({
      id: 'functions_count',
      label: 'Wedding Ceremonies / Functions',
      value: `${profile.functionsCount} ceremonies`,
      source: 'user',
      editable: true,
    });
  }

  // Category splits
  const splits = pack.budgetSplits[profile.eventType] ?? [];
  for (const split of splits) {
    items.push({
      id: `split_${split.id}`,
      label: `Base Split: ${split.label}`,
      value: `${split.weight}%`,
      source: 'assumption',
      editable: true,
    });
  }

  return items;
}
