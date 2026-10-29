import { EventProfile } from '../schemas/profile';
import { LocalePack } from '../config/types';
import { indiaLocalePack } from '../config/in';
import { computeBudget, BudgetResult } from './budget';
import { computeTimeline, TimelineResult } from './timeline';
import { computeChecklist, ChecklistResult } from './checklist';
import { computeFlags, Flag } from './flags';
import { computeAssumptions, AssumptionItem } from './assumptions';

export interface BasePlan {
  version: 1;
  profile: EventProfile;
  today: string;
  mode: 'standard' | 'compressed';
  daysToEvent: number;
  budget: BudgetResult;
  timeline: TimelineResult;
  checklist: ChecklistResult;
  flags: Flag[];
  assumptions: AssumptionItem[];
}

/**
 * Builds a complete celebration plan from a validated EventProfile.
 * Pure and deterministic.
 */
export function buildPlan(
  profile: EventProfile,
  today: string,
  pack: LocalePack = indiaLocalePack
): BasePlan {
  const budget = computeBudget(profile, pack);
  const timeline = computeTimeline(profile, pack, today);
  const checklist = computeChecklist(profile, pack, today);
  const flags = computeFlags(profile, budget, timeline, pack);
  const assumptions = computeAssumptions(profile, pack);

  return {
    version: 1,
    profile,
    today,
    mode: timeline.mode,
    daysToEvent: timeline.daysToEvent,
    budget,
    timeline,
    checklist,
    flags,
    assumptions,
  };
}
