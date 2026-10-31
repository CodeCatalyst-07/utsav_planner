import { EventProfile, BudgetTier } from '../schemas/profile';
import { LocalePack } from '../config/types';
import { allocateLargestRemainder, formatInr } from '../money/inr';
import { getMonth1Based } from '../dates';

export interface BudgetLineExplanation {
  formula: string;
  inputs: Record<string, unknown>;
}

export interface BudgetLine {
  id: string;
  label: string;
  amount: number; // integer rupees
  percent: number; // percentage of total
  source: 'split' | 'override' | 'derived';
  explanation: BudgetLineExplanation;
}

export interface CateringSuggestions {
  maxGuestsForAllocation: number;
  alternativeTier?: BudgetTier;
  savingsNeeded: number;
}

export interface CateringEstimates {
  low: number;
  high: number;
  mid: number;
  status: 'ok' | 'tight' | 'over';
  perPlateMin: number;
  perPlateMax: number;
  perPlateMid: number;
  functionsFactor: number;
  seasonFactor: number;
  suggestions?: CateringSuggestions;
}

export interface BudgetInvariants {
  sumEqualsTotal: boolean;
  noNegativeLines: boolean;
  contingencyMeetsFloor: boolean;
}

export interface BudgetResult {
  total: number;
  lines: BudgetLine[];
  unallocated: 0;
  estimates: {
    catering: CateringEstimates;
    maxGuestsForAllocation: number;
  };
  invariants: BudgetInvariants;
}

export function calculateFunctionsFactor(
  eventType: string,
  functionsCount: number,
  pack: LocalePack
): number {
  if (eventType === 'wedding') {
    const base = pack.cateringEventTypeMultipliers.weddingBase;
    const subsequent = pack.cateringEventTypeMultipliers.weddingSubsequentFunctionMultiplier;
    return base + Math.max(0, functionsCount - 1) * subsequent;
  }
  if (eventType === 'birthday_adult') {
    return pack.cateringEventTypeMultipliers.birthdayAdult;
  }
  if (eventType === 'birthday_kids') {
    return pack.cateringEventTypeMultipliers.birthdayKids;
  }
  return 1.0;
}

export function calculateSeasonFactor(
  eventDate: string,
  eventType: string,
  pack: LocalePack
): number {
  const month = getMonth1Based(eventDate);
  if (eventType === 'wedding' && pack.seasonRules.weddingPeakMonths.includes(month)) {
    return pack.seasonRules.weddingPeakFactor;
  }
  return 1.0;
}

/**
 * Deterministic budget engine for Indian celebrations.
 *
 * Invariants:
 * 1. sum(lines.amount) === total EXACTLY (zero unallocated rupees).
 * 2. All amounts are non-negative integers.
 * 3. Contingency >= 5% floor unless user explicitly overrides it.
 */
export function computeBudget(profile: EventProfile, pack: LocalePack): BudgetResult {
  const total = profile.totalBudgetInr;
  const splitCategories = pack.budgetSplits[profile.eventType] ?? [];

  // Determine active categories and dropped categories based on toggles
  interface IntermediateCategory {
    id: string;
    label: string;
    baseWeight: number;
    isOverridden: boolean;
    overrideAmount?: number;
    isDropped: boolean;
    dropReason?: string;
  }

  const intermediate: IntermediateCategory[] = splitCategories.map((cat) => {
    let isDropped = false;
    let dropReason: string | undefined;

    if (cat.id === 'venue' && profile.toggles.venueIncluded) {
      isDropped = true;
      dropReason = 'Venue provided free or hosted at home via toggle';
    }

    if (
      cat.id === 'attire_jewellery' &&
      profile.eventType === 'wedding' &&
      !profile.toggles.includeAttireJewellery
    ) {
      isDropped = true;
      dropReason = 'Attire and jewellery excluded from budget via toggle';
    }

    const overrideVal = profile.overrides[cat.id];
    const isOverridden = overrideVal !== undefined && overrideVal >= 0;

    return {
      id: cat.id,
      label: cat.label,
      baseWeight: cat.weight,
      isOverridden,
      overrideAmount: overrideVal,
      isDropped,
      dropReason,
    };
  });

  // Calculate allocated overrides
  let totalOverrides = 0;
  for (const item of intermediate) {
    if (item.isOverridden && !item.isDropped) {
      totalOverrides += item.overrideAmount!;
    }
  }

  // Active items to allocate dynamically
  const dynamicItems = intermediate.filter((item) => !item.isOverridden && !item.isDropped);

  // If overrides exceed or equal total, cap remaining to 0
  const remainingBudget = Math.max(0, total - totalOverrides);

  // Adjust contingency weight to ensure floor >= contingencyFloorPercent
  const dynamicWeights: number[] = [];
  for (const item of dynamicItems) {
    if (item.id === 'contingency') {
      dynamicWeights.push(Math.max(item.baseWeight, pack.contingencyFloorPercent));
    } else {
      dynamicWeights.push(item.baseWeight);
    }
  }

  const allocatedAmounts = allocateLargestRemainder(remainingBudget, dynamicWeights);

  const lines: BudgetLine[] = [];
  let dynamicIdx = 0;

  for (const item of intermediate) {
    if (item.isDropped) {
      lines.push({
        id: item.id,
        label: item.label,
        amount: 0,
        percent: 0,
        source: 'derived',
        explanation: {
          formula: '0 (Excluded via toggle)',
          inputs: { reason: item.dropReason },
        },
      });
      continue;
    }

    if (item.isOverridden) {
      const amount = Math.min(item.overrideAmount!, total);
      const percent = total > 0 ? Number(((amount / total) * 100).toFixed(1)) : 0;
      lines.push({
        id: item.id,
        label: item.label,
        amount,
        percent,
        source: 'override',
        explanation: {
          formula: 'User-specified override',
          inputs: { overrideAmount: item.overrideAmount },
        },
      });
      continue;
    }

    const amount = allocatedAmounts[dynamicIdx] ?? 0;
    const weight = dynamicWeights[dynamicIdx] ?? 0;
    dynamicIdx++;

    const percent = total > 0 ? Number(((amount / total) * 100).toFixed(1)) : 0;
    lines.push({
      id: item.id,
      label: item.label,
      amount,
      percent,
      source: 'split',
      explanation: {
        formula: `Normalized weight allocation: ~${weight}% of remaining ${formatInr(remainingBudget)}`,
        inputs: {
          baseWeight: item.baseWeight,
          allocatedRemaining: remainingBudget,
        },
      },
    });
  }

  // Adjust for any minor total mismatch if overrides exceeded total
  const currentSum = lines.reduce((acc, l) => acc + l.amount, 0);
  if (currentSum !== total) {
    const diff = total - currentSum;
    // Apply diff to contingency line or first non-overridden line
    const adjustTarget =
      lines.find((l) => l.id === 'contingency' && l.source !== 'override') ||
      lines.find((l) => l.source !== 'override') ||
      lines[0];

    if (adjustTarget && adjustTarget.amount + diff >= 0) {
      adjustTarget.amount += diff;
      adjustTarget.percent =
        total > 0 ? Number(((adjustTarget.amount / total) * 100).toFixed(1)) : 0;
    }
  }

  // Catering Cost Estimation
  let perPlateMin = 0;
  let perPlateMax = 0;

  if (profile.eventType === 'community_festival') {
    perPlateMin = pack.communityFestivalCateringBand.min;
    perPlateMax = pack.communityFestivalCateringBand.max;
  } else {
    const bands = pack.cateringBands[profile.cityTier]?.[profile.budgetTier] ?? {
      min: 500,
      max: 1000,
    };
    perPlateMin = bands.min;
    perPlateMax = bands.max;
  }

  const perPlateMid = Math.round((perPlateMin + perPlateMax) / 2);
  const functionsFactor = calculateFunctionsFactor(profile.eventType, profile.functionsCount, pack);
  const seasonFactor = calculateSeasonFactor(profile.eventDate, profile.eventType, pack);

  const totalCateringUnits = profile.guestCount * functionsFactor * seasonFactor;
  const cateringLow = Math.round(perPlateMin * totalCateringUnits);
  const cateringHigh = Math.round(perPlateMax * totalCateringUnits);
  const cateringMid = Math.round(perPlateMid * totalCateringUnits);

  const cateringLine = lines.find((l) => l.id === 'catering');
  const cateringAllocation = cateringLine ? cateringLine.amount : 0;

  let cateringStatus: 'ok' | 'tight' | 'over' = 'ok';
  if (cateringAllocation < cateringMid) {
    cateringStatus = 'over';
  } else if (cateringAllocation < cateringHigh) {
    cateringStatus = 'tight';
  }

  // Suggestions if tight or over
  const perGuestAtMid = perPlateMid * functionsFactor * seasonFactor;
  const maxGuestsForAllocation =
    perGuestAtMid > 0 ? Math.floor(cateringAllocation / perGuestAtMid) : profile.guestCount;

  let suggestions: CateringSuggestions | undefined;
  if (cateringStatus !== 'ok') {
    const statusRank: Record<'over' | 'tight' | 'ok', number> = { over: 0, tight: 1, ok: 2 };

    const evaluateTierStatus = (candidateTier: BudgetTier): 'ok' | 'tight' | 'over' => {
      const candidateBands = pack.cateringBands[profile.cityTier]?.[candidateTier];
      if (!candidateBands) return 'over';
      const cMid = Math.round(((candidateBands.min + candidateBands.max) / 2) * totalCateringUnits);
      const cHigh = Math.round(candidateBands.max * totalCateringUnits);
      if (cateringAllocation < cMid) {
        return 'over';
      } else if (cateringAllocation < cHigh) {
        return 'tight';
      }
      return 'ok';
    };

    let alternativeTier: BudgetTier | undefined;
    if (profile.budgetTier === 'premium') {
      const midStatus = evaluateTierStatus('mid');
      if (midStatus !== 'over' && statusRank[midStatus] > statusRank[cateringStatus]) {
        alternativeTier = 'mid';
      } else {
        const budgetStatus = evaluateTierStatus('budget');
        if (budgetStatus !== 'over' && statusRank[budgetStatus] > statusRank[cateringStatus]) {
          alternativeTier = 'budget';
        }
      }
    } else if (profile.budgetTier === 'mid') {
      const budgetStatus = evaluateTierStatus('budget');
      if (budgetStatus !== 'over' && statusRank[budgetStatus] > statusRank[cateringStatus]) {
        alternativeTier = 'budget';
      }
    }

    suggestions = {
      maxGuestsForAllocation,
      alternativeTier,
      savingsNeeded: Math.max(0, cateringMid - cateringAllocation),
    };
  }

  const contingencyLine = lines.find((l) => l.id === 'contingency');
  const contingencyFloorAmount = Math.round((total * pack.contingencyFloorPercent) / 100);
  const contingencyMeetsFloor = contingencyLine
    ? contingencyLine.amount >= contingencyFloorAmount
    : false;

  const finalSum = lines.reduce((acc, l) => acc + l.amount, 0);
  const noNegativeLines = lines.every((l) => l.amount >= 0);

  return {
    total,
    lines,
    unallocated: 0,
    estimates: {
      catering: {
        low: cateringLow,
        high: cateringHigh,
        mid: cateringMid,
        status: cateringStatus,
        perPlateMin,
        perPlateMax,
        perPlateMid,
        functionsFactor,
        seasonFactor,
        suggestions,
      },
      maxGuestsForAllocation,
    },
    invariants: {
      sumEqualsTotal: finalSum === total,
      noNegativeLines,
      contingencyMeetsFloor,
    },
  };
}
