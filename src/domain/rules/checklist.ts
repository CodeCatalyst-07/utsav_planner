import { EventProfile } from '../schemas/profile';
import { LocalePack, PriorityLevel } from '../config/types';
import { addDays, isDateBefore, getMonth1Based } from '../dates';

export interface ChecklistItem {
  id: string;
  label: string;
  budgetCategory: string;
  priority: PriorityLevel;
  leadDays: number;
  dueDate: string; // YYYY-MM-DD
  mapsQuery: string;
  note?: string;
  isConditional?: boolean;
}

export interface ChecklistResult {
  items: ChecklistItem[];
}

export function resolveMapsQuery(
  template: string,
  label: string,
  cityName?: string,
  cityTier?: string
): string {
  const cityReplacement = cityName?.trim() || (cityTier ? cityTier.toUpperCase() : 'India');
  return template.replace('{label}', label).replace('{cityName}', cityReplacement);
}

/**
 * Evaluates standard and conditional vendor checklist items.
 * Pure and deterministic.
 */
export function computeChecklist(
  profile: EventProfile,
  pack: LocalePack,
  today: string
): ChecklistResult {
  const baseTemplates = pack.vendorChecklists[profile.eventType] ?? [];
  const items: ChecklistItem[] = [];

  // Helper to create checklist item
  const createItem = (
    tmpl: {
      id: string;
      label: string;
      budgetCategory: string;
      priority: PriorityLevel;
      leadDays: number;
      mapsQueryTemplate: string;
    },
    note?: string,
    isConditional = false
  ): ChecklistItem => {
    let dueDate = addDays(profile.eventDate, -tmpl.leadDays);
    if (isDateBefore(dueDate, today)) {
      dueDate = today;
    }

    const mapsQuery = resolveMapsQuery(
      tmpl.mapsQueryTemplate,
      tmpl.label,
      profile.cityName,
      profile.cityTier
    );

    return {
      id: tmpl.id,
      label: tmpl.label,
      budgetCategory: tmpl.budgetCategory,
      priority: tmpl.priority,
      leadDays: tmpl.leadDays,
      dueDate,
      mapsQuery,
      note,
      isConditional,
    };
  };

  // Base items
  for (const tmpl of baseTemplates) {
    let effectivePriority = tmpl.priority;
    // Rule: kids birthday safety_first_aid is always high priority
    if (profile.eventType === 'birthday_kids' && tmpl.id === 'safety_first_aid') {
      effectivePriority = 'high';
    }

    items.push(
      createItem({
        ...tmpl,
        priority: effectivePriority,
      })
    );
  }

  // Evaluate Declarative Conditional Rules
  const eventMonth = getMonth1Based(profile.eventDate);
  const isMonsoon = pack.seasonRules.monsoonMonths.includes(eventMonth);
  const isOutdoor = pack.seasonRules.outdoorVenues.includes(profile.venueType);

  for (const rule of pack.conditionalRules) {
    let triggered = false;

    switch (rule.condition) {
      case 'destination_venue':
        triggered = profile.venueType === 'destination';
        break;
      case 'monsoon_outdoor':
        triggered = isMonsoon && isOutdoor;
        break;
      case 'jain_dietary':
        triggered = profile.dietary.jain > 0;
        break;
      case 'vegan_dietary':
        triggered = profile.dietary.vegan > 0;
        break;
      case 'multi_function_wedding':
        triggered = profile.eventType === 'wedding' && profile.functionsCount > 1;
        break;
      case 'kids_birthday_safety':
        // Already handled above
        triggered = false;
        break;
    }

    if (triggered) {
      // Avoid duplicate IDs
      if (!items.some((existing) => existing.id === rule.item.id)) {
        items.push(createItem(rule.item, rule.note, true));
      }
    }
  }

  // Sort by dueDate ascending, then priority (high > medium > low)
  const priorityRank: Record<PriorityLevel, number> = {
    high: 1,
    medium: 2,
    low: 3,
  };

  items.sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return priorityRank[a.priority] - priorityRank[b.priority];
  });

  return { items };
}
