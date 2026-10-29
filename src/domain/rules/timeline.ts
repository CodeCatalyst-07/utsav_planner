import { EventProfile } from '../schemas/profile';
import { LocalePack, MilestoneDefinition } from '../config/types';
import { addDays, daysBetween, isDateBefore, isDateAfter } from '../dates';

export interface MilestoneItem {
  id: string;
  title: string;
  detail: string;
  date: string; // YYYY-MM-DD
  daysBeforeEvent: number; // positive = days before, negative = days after
  critical: boolean;
  verifyNote?: string;
  phase: 'before' | 'after';
  catchUp?: boolean;
}

export interface TimelineResult {
  mode: 'standard' | 'compressed';
  daysToEvent: number;
  minLeadDays: number;
  milestones: MilestoneItem[];
  criticalVendorsUnavailableNotice: boolean;
}

/**
 * Deterministic timeline engine for Indian celebrations.
 *
 * Invariants:
 * 1. Standard mode when daysToEvent >= minLeadDays.
 * 2. Compressed mode scales pre-event offsets into [today, eventDate - 1].
 * 3. Pre-event dates are non-decreasing and all within [today, eventDate - 1].
 * 4. Deterministic and pure (no Date.now()).
 */
export function computeTimeline(
  profile: EventProfile,
  pack: LocalePack,
  today: string
): TimelineResult {
  const daysToEvent = daysBetween(today, profile.eventDate);
  const minLeadDays = pack.minLeadDays[profile.eventType] ?? 180;
  const isCompressed = daysToEvent < minLeadDays;
  const mode: 'standard' | 'compressed' = isCompressed ? 'compressed' : 'standard';

  const rawMilestones: MilestoneDefinition[] = pack.milestones[profile.eventType] ?? [];

  // Split into pre-event (offset > 0) and post-event (offset <= 0)
  const preEvent = rawMilestones.filter((m) => m.offset > 0).sort((a, b) => b.offset - a.offset); // largest offset first (earliest in time)

  const postEvent = rawMilestones.filter((m) => m.offset <= 0).sort((a, b) => b.offset - a.offset);

  const finalMilestones: MilestoneItem[] = [];

  if (!isCompressed) {
    // Standard Mode: date = eventDate - offset
    for (const m of preEvent) {
      const scheduledDate = addDays(profile.eventDate, -m.offset);
      const isPast = isDateBefore(scheduledDate, today);

      finalMilestones.push({
        id: m.id,
        title: m.title,
        detail: m.detail,
        date: scheduledDate,
        daysBeforeEvent: m.offset,
        critical: m.critical,
        verifyNote: m.verifyNote,
        phase: 'before',
        catchUp: isPast,
      });
    }
  } else {
    // Compressed Mode:
    // Scale pre-event offsets proportionally into the window [today, eventDate - 1]
    const maxWindowDays = Math.max(0, daysToEvent - 1);
    const maxOriginalOffset = preEvent.length > 0 ? preEvent[0]!.offset : 1;

    let previousDate = today;

    for (const m of preEvent) {
      // Standard date for checking catch-up status
      const standardDate = addDays(profile.eventDate, -m.offset);
      const wasPastInStandard = isDateBefore(standardDate, today);

      // Scaled offset: relative position from eventDate backwards
      let scaledDaysBefore =
        maxOriginalOffset > 0 ? Math.round((m.offset / maxOriginalOffset) * maxWindowDays) : 0;

      // Ensure at least 0 days before event and at most maxWindowDays
      scaledDaysBefore = Math.max(0, Math.min(scaledDaysBefore, maxWindowDays));

      let computedDate = addDays(profile.eventDate, -scaledDaysBefore);

      // Invariant: Never earlier than today
      if (isDateBefore(computedDate, today)) {
        computedDate = today;
      }

      // Invariant: Non-decreasing monotonic sequence
      if (isDateBefore(computedDate, previousDate)) {
        computedDate = previousDate;
      }

      // Invariant: Pre-event dates must never equal or exceed eventDate
      const dayBeforeEvent = addDays(profile.eventDate, -1);
      if (isDateAfter(computedDate, dayBeforeEvent) && isDateBefore(today, profile.eventDate)) {
        computedDate = dayBeforeEvent;
      }

      previousDate = computedDate;
      const actualDaysBefore = daysBetween(computedDate, profile.eventDate);

      finalMilestones.push({
        id: m.id,
        title: m.title,
        detail: m.detail,
        date: computedDate,
        daysBeforeEvent: actualDaysBefore,
        critical: m.critical,
        verifyNote: m.verifyNote,
        phase: 'before',
        catchUp: wasPastInStandard,
      });
    }
  }

  // Post-event milestones (offsets <= 0) keep their offset
  for (const m of postEvent) {
    const scheduledDate = addDays(profile.eventDate, -m.offset);
    finalMilestones.push({
      id: m.id,
      title: m.title,
      detail: m.detail,
      date: scheduledDate,
      daysBeforeEvent: m.offset,
      critical: m.critical,
      verifyNote: m.verifyNote,
      phase: 'after',
      catchUp: false,
    });
  }

  // Sort overall milestones by date ascending, pre-event before post-event
  finalMilestones.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    // Stable order preservation
    return b.daysBeforeEvent - a.daysBeforeEvent;
  });

  return {
    mode,
    daysToEvent,
    minLeadDays,
    milestones: finalMilestones,
    criticalVendorsUnavailableNotice: isCompressed,
  };
}
