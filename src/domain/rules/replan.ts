import { BasePlan, buildPlan } from './plan';
import { validateProfile, ValidationError, scaleDietary, Dietary } from '../schemas/profile';
import { LocalePack } from '../config/types';
import { indiaLocalePack } from '../config/in';
import { daysBetween } from '../dates';
import { formatInr } from '../money/inr';

export interface BudgetLineDelta {
  id: string;
  before: number;
  after: number;
  delta: number;
}

export interface MilestoneShift {
  id: string;
  beforeDate: string;
  afterDate: string;
  daysDelta: number;
}

export interface PlanDiff {
  budgetLines: BudgetLineDelta[];
  totalDelta: number;
  cateringEstimateDelta: number;
  milestonesShifted: MilestoneShift[];
  checklistAdded: string[];
  checklistRemoved: string[];
  flagsAdded: string[];
  flagsRemoved: string[];
  summaryFacts: string[];
}

export type ReplanResult =
  { ok: true; plan: BasePlan; diff: PlanDiff } | { ok: false; errors: ValidationError[] };

/**
 * Re-plans an event given a patch.
 *
 * Guarantees:
 * 1. Validates merged state with validateProfile.
 * 2. Pure and deterministic diff computation.
 * 3. summaryFacts contain only mathematically verifiable statements.
 */
export function replan(
  currentPlan: BasePlan,
  patch: Record<string, unknown>,
  today: string,
  pack: LocalePack = indiaLocalePack
): ReplanResult {
  // Merge current profile with patch
  const current = currentPlan.profile;
  let dietary = {
    ...current.dietary,
    ...(patch.dietary && typeof patch.dietary === 'object'
      ? (patch.dietary as Partial<Dietary>)
      : {}),
  };
  if (typeof patch.guestCount === 'number' && !patch.dietary) {
    dietary = scaleDietary(dietary, patch.guestCount);
  }

  const mergedInput = {
    ...current,
    ...patch,
    dietary,
    toggles: {
      ...current.toggles,
      ...(patch.toggles && typeof patch.toggles === 'object' ? patch.toggles : {}),
    },
    overrides: {
      ...current.overrides,
      ...(patch.overrides && typeof patch.overrides === 'object' ? patch.overrides : {}),
    },
  };

  const validation = validateProfile(mergedInput, today);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const updatedProfile = validation.data;
  const newPlan = buildPlan(updatedProfile, today, pack);

  // Compute Diffs
  const summaryFacts: string[] = [];

  // 1. Budget Lines Diff
  const budgetLines: BudgetLineDelta[] = [];
  const currentLinesMap = new Map(currentPlan.budget.lines.map((l) => [l.id, l.amount]));
  const newLinesMap = new Map(newPlan.budget.lines.map((l) => [l.id, l.amount]));

  const allCategoryIds = new Set([...currentLinesMap.keys(), ...newLinesMap.keys()]);
  for (const id of allCategoryIds) {
    const before = currentLinesMap.get(id) ?? 0;
    const after = newLinesMap.get(id) ?? 0;
    const delta = after - before;
    if (delta !== 0) {
      budgetLines.push({ id, before, after, delta });
      const sign = delta > 0 ? '+' : '';
      summaryFacts.push(`${id} budget allocation changed by ${sign}${formatInr(delta)}`);
    }
  }

  const totalDelta = newPlan.budget.total - currentPlan.budget.total;
  if (totalDelta !== 0) {
    const sign = totalDelta > 0 ? '+' : '';
    summaryFacts.push(`Total event budget changed by ${sign}${formatInr(totalDelta)}`);
  }

  // 2. Catering Estimate Delta
  const beforeCateringMid = currentPlan.budget.estimates.catering.mid;
  const afterCateringMid = newPlan.budget.estimates.catering.mid;
  const cateringEstimateDelta = afterCateringMid - beforeCateringMid;
  if (cateringEstimateDelta !== 0) {
    const sign = cateringEstimateDelta > 0 ? '+' : '';
    summaryFacts.push(
      `Estimated catering requirement shifted by ${sign}${formatInr(cateringEstimateDelta)}`
    );
  }

  // 3. Guest count change
  if (updatedProfile.guestCount !== current.guestCount) {
    const guestDelta = updatedProfile.guestCount - current.guestCount;
    const sign = guestDelta > 0 ? '+' : '';
    summaryFacts.push(
      `Guest count adjusted from ${current.guestCount} to ${updatedProfile.guestCount} (${sign}${guestDelta} guests)`
    );
  }

  // 4. Event Date shift
  if (updatedProfile.eventDate !== current.eventDate) {
    const dateShiftDays = daysBetween(current.eventDate, updatedProfile.eventDate);
    const sign = dateShiftDays > 0 ? '+' : '';
    summaryFacts.push(
      `Event date shifted from ${current.eventDate} to ${updatedProfile.eventDate} (${sign}${dateShiftDays} days)`
    );
  }

  // 5. Milestones Shifted
  const milestonesShifted: MilestoneShift[] = [];
  const currentMilestonesMap = new Map(currentPlan.timeline.milestones.map((m) => [m.id, m.date]));

  for (const newM of newPlan.timeline.milestones) {
    const beforeDate = currentMilestonesMap.get(newM.id);
    if (beforeDate && beforeDate !== newM.date) {
      const daysDelta = daysBetween(beforeDate, newM.date);
      milestonesShifted.push({
        id: newM.id,
        beforeDate,
        afterDate: newM.date,
        daysDelta,
      });
    }
  }

  if (milestonesShifted.length > 0) {
    summaryFacts.push(
      `${milestonesShifted.length} planning milestones rescheduled to fit the new timeline`
    );
  }

  // 6. Checklist Items Added / Removed
  const currentChecklistIds = new Set(currentPlan.checklist.items.map((i) => i.id));
  const newChecklistIds = new Set(newPlan.checklist.items.map((i) => i.id));

  const checklistAdded = Array.from(newChecklistIds).filter((id) => !currentChecklistIds.has(id));
  const checklistRemoved = Array.from(currentChecklistIds).filter((id) => !newChecklistIds.has(id));

  if (checklistAdded.length > 0) {
    summaryFacts.push(
      `Added ${checklistAdded.length} checklist item(s): ${checklistAdded.join(', ')}`
    );
  }
  if (checklistRemoved.length > 0) {
    summaryFacts.push(
      `Removed ${checklistRemoved.length} checklist item(s): ${checklistRemoved.join(', ')}`
    );
  }

  // 7. Flags Added / Removed
  const currentFlagCodes = new Set(currentPlan.flags.map((f) => f.code));
  const newFlagCodes = new Set(newPlan.flags.map((f) => f.code));

  const flagsAdded = Array.from(newFlagCodes).filter((code) => !currentFlagCodes.has(code));
  const flagsRemoved = Array.from(currentFlagCodes).filter((code) => !newFlagCodes.has(code));

  if (flagsAdded.length > 0) {
    summaryFacts.push(`New advisory notice(s) raised: ${flagsAdded.join(', ')}`);
  }
  if (flagsRemoved.length > 0) {
    summaryFacts.push(`Resolved advisory notice(s): ${flagsRemoved.join(', ')}`);
  }

  const diff: PlanDiff = {
    budgetLines,
    totalDelta,
    cateringEstimateDelta,
    milestonesShifted,
    checklistAdded,
    checklistRemoved,
    flagsAdded,
    flagsRemoved,
    summaryFacts,
  };

  return { ok: true, plan: newPlan, diff };
}
