import { EventProfile } from '../schemas/profile';
import { LocalePack } from '../config/types';
import { BudgetResult } from './budget';
import { TimelineResult } from './timeline';
import { flagMessages, FlagCode } from '../config/in/messages';
import { formatInr } from '../money/inr';
import { getMonth1Based } from '../dates';

export interface Flag {
  code: FlagCode;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  params?: Record<string, unknown>;
}

/**
 * Computes warning, critical, and advisory flags across the plan.
 * Pure and deterministic.
 */
export function computeFlags(
  profile: EventProfile,
  budget: BudgetResult,
  timeline: TimelineResult,
  pack: LocalePack
): Flag[] {
  const flags: Flag[] = [];

  // 1. Compressed plan flag
  if (timeline.mode === 'compressed') {
    const severity: 'warning' | 'critical' = timeline.daysToEvent < 30 ? 'critical' : 'warning';
    flags.push({
      code: 'compressed_plan',
      severity,
      message: flagMessages.compressed_plan({
        minLeadDays: timeline.minLeadDays,
        daysToEvent: timeline.daysToEvent,
      }),
      params: { minLeadDays: timeline.minLeadDays, daysToEvent: timeline.daysToEvent },
    });
  }

  // 2. Peak season pricing flag
  if (budget.estimates.catering.seasonFactor > 1.0) {
    flags.push({
      code: 'peak_season',
      severity: 'info',
      message: flagMessages.peak_season({ factor: budget.estimates.catering.seasonFactor }),
      params: { factor: budget.estimates.catering.seasonFactor },
    });
  }

  // 3. Monsoon outdoor venue warning
  const eventMonth = getMonth1Based(profile.eventDate);
  const isMonsoon = pack.seasonRules.monsoonMonths.includes(eventMonth);
  const isOutdoor = pack.seasonRules.outdoorVenues.includes(profile.venueType);

  if (isMonsoon && isOutdoor) {
    flags.push({
      code: 'monsoon_outdoor',
      severity: 'warning',
      message: flagMessages.monsoon_outdoor({ venueType: profile.venueType }),
      params: { venueType: profile.venueType, eventMonth },
    });
  }

  // 4. Catering over allocation (Critical)
  const cateringLine = budget.lines.find((l) => l.id === 'catering');
  const cateringAllocation = cateringLine ? cateringLine.amount : 0;
  const cateringMid = budget.estimates.catering.mid;

  if (budget.estimates.catering.status === 'over') {
    const deficit = Math.max(0, cateringMid - cateringAllocation);
    flags.push({
      code: 'catering_over',
      severity: 'critical',
      message: flagMessages.catering_over({
        allocation: formatInr(cateringAllocation),
        midEstimate: formatInr(cateringMid),
        deficit: formatInr(deficit),
      }),
      params: {
        allocation: cateringAllocation,
        estimateMid: budget.estimates.catering.mid,
        estimateHigh: budget.estimates.catering.high,
        suggestions: budget.estimates.catering.suggestions,
      },
    });
  } else if (budget.estimates.catering.status === 'tight') {
    // 5. Catering tight allocation (Warning)
    flags.push({
      code: 'catering_tight',
      severity: 'warning',
      message: flagMessages.catering_tight({
        allocation: formatInr(cateringAllocation),
        highEstimate: formatInr(budget.estimates.catering.high),
        budgetTier: profile.budgetTier,
      }),
      params: {
        allocation: cateringAllocation,
        estimateMid: budget.estimates.catering.mid,
        estimateHigh: budget.estimates.catering.high,
        suggestions: budget.estimates.catering.suggestions,
      },
    });
  }

  // 6. Per head budget threshold warning
  const perHeadBudget = Math.floor(profile.totalBudgetInr / profile.guestCount);
  let minThreshold = pack.perHeadThresholds.weddingMinBudgetPerHead;
  if (profile.eventType.startsWith('birthday')) {
    minThreshold = pack.perHeadThresholds.birthdayMinBudgetPerHead;
  } else if (profile.eventType === 'community_festival') {
    minThreshold = pack.perHeadThresholds.communityFestivalMinBudgetPerHead;
  }

  if (perHeadBudget < minThreshold) {
    flags.push({
      code: 'per_head_budget_low',
      severity: 'warning',
      message: flagMessages.per_head_budget_low({
        perHead: formatInr(perHeadBudget),
        minThreshold: formatInr(minThreshold),
      }),
      params: { perHeadBudget, minThreshold },
    });
  }

  // 7. Contingency below floor warning
  if (!budget.invariants.contingencyMeetsFloor) {
    const contingencyLine = budget.lines.find((l) => l.id === 'contingency');
    const actualPercent =
      contingencyLine && budget.total > 0 ? (contingencyLine.amount / budget.total) * 100 : 0;

    flags.push({
      code: 'contingency_below_floor',
      severity: 'warning',
      message: flagMessages.contingency_below_floor({
        actualPercent,
        floorPercent: pack.contingencyFloorPercent,
      }),
      params: { actualPercent, floorPercent: pack.contingencyFloorPercent },
    });
  }

  // 8. Special dietary requirements info
  if (profile.dietary.jain > 0 || profile.dietary.vegan > 0) {
    const parts: string[] = [];
    if (profile.dietary.jain > 0) {
      parts.push(`${profile.dietary.jain} Jain`);
    }
    if (profile.dietary.vegan > 0) {
      parts.push(`${profile.dietary.vegan} Vegan`);
    }
    flags.push({
      code: 'special_diet_counters',
      severity: 'info',
      message: flagMessages.special_diet_counters({ detail: parts.join(', ') }),
      params: { jain: profile.dietary.jain, vegan: profile.dietary.vegan },
    });
  }

  // 9. Wedding muhurat verification (Always info for weddings)
  if (profile.eventType === 'wedding') {
    flags.push({
      code: 'wedding_muhurat_verify',
      severity: 'info',
      message: flagMessages.wedding_muhurat_verify(),
    });
  }

  // 10. Community permissions verification (Always info for community festivals)
  if (profile.eventType === 'community_festival') {
    flags.push({
      code: 'community_permissions_verify',
      severity: 'info',
      message: flagMessages.community_permissions_verify(),
    });
  }

  // 11. Catch-up required flag
  const caughtUpMilestones = timeline.milestones.filter((m) => m.catchUp);
  if (caughtUpMilestones.length > 0) {
    const criticalCount = caughtUpMilestones.filter((m) => m.critical).length;
    // Warning only if a caught-up critical milestone was >= 45 days past its standard date
    const hasSeverelyOverdueCritical = caughtUpMilestones.some(
      (m) => m.critical && m.standardOffsetDays - timeline.daysToEvent >= 45
    );
    const severity: 'warning' | 'info' = hasSeverelyOverdueCritical ? 'warning' : 'info';
    flags.push({
      code: 'catch_up_needed',
      severity,
      message: flagMessages.catch_up_needed({
        count: caughtUpMilestones.length,
        criticalCount,
      }),
      params: { count: caughtUpMilestones.length, criticalCount },
    });
  }

  return flags;
}
