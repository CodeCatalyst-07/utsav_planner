/**
 * src/domain/intents/parseIntent.ts
 *
 * Deterministic intent rule parser for Utsav Planner chat.
 * Pure TypeScript in the domain layer (zero I/O, zero network).
 * Used as the deterministic fallback when no LLM keys are configured or when providers fail.
 */

import { EventProfile } from '../schemas/profile';
import { parseInrAmount, formatInr } from '../money/inr';
import { isDateBefore, isValidDateString } from '../dates';

export type ParsedIntent =
  | {
      intent: 'update_plan';
      reply: string;
      patch: Record<string, unknown>;
    }
  | {
      intent: 'question';
      reply: string;
    }
  | {
      intent: 'unsupported';
      reply: string;
      examples: string[];
    };

const UNSUPPORTED_EXAMPLES = [
  'What if we cut the guest list to 150?',
  'Increase the budget by 5 lakh',
  'Move the date to 2027-03-12',
  'What should I book first?',
];

// Month map for flexible date parsing like "12 Mar 2027"
const MONTH_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

function parseFlexibleDate(str: string): string | null {
  const clean = str.trim().replace(/,/g, '');

  // 1. ISO format: YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return isValidDateString(clean) ? clean : null;
  }

  // 2. "12 Mar 2027" or "12 March 2027"
  const dmyMatch = clean.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1]!.padStart(2, '0');
    const mStr = dmyMatch[2]!.toLowerCase();
    const year = dmyMatch[3]!;
    const month = MONTH_MAP[mStr];
    if (month) {
      const candidate = `${year}-${month}-${day}`;
      return isValidDateString(candidate) ? candidate : null;
    }
  }

  // 3. "March 12 2027"
  const mdyMatch = clean.match(/^([a-zA-Z]+)\s+(\d{1,2})\s+(\d{4})$/);
  if (mdyMatch) {
    const mStr = mdyMatch[1]!.toLowerCase();
    const day = mdyMatch[2]!.padStart(2, '0');
    const year = mdyMatch[3]!;
    const month = MONTH_MAP[mStr];
    if (month) {
      const candidate = `${year}-${month}-${day}`;
      return isValidDateString(candidate) ? candidate : null;
    }
  }

  return null;
}

export function parseIntent(
  message: string,
  profile?: EventProfile,
  today: string = '2026-10-30'
): ParsedIntent {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      intent: 'unsupported',
      reply: 'Please ask a celebration question or suggest a plan adjustment.',
      examples: UNSUPPORTED_EXAMPLES,
    };
  }

  const lower = trimmed.toLowerCase();

  // Guard against Hindi-English or mixed language commands (strict rule: yield unsupported, never wrong guess)
  const hindiIndicators = [
    /\bkar\s+do\b/,
    /\bkardo\b/,
    /\bkaro\b/,
    /\bbadha\s+do\b/,
    /\bkam\s+karo\b/,
    /\brakho\b/,
    /\bhoga\b/,
    /\bkahiye\b/,
    /\bkarna\b/,
    /\bbatao\b/,
    /\bkitna\b/,
    /\bkyun\b/,
    /\bkaise\b/,
    /\bshadi\b/,
  ];
  if (hindiIndicators.some((regex) => regex.test(lower))) {
    return {
      intent: 'unsupported',
      reply:
        'I currently parse instructions in standard English. Please try one of the recommended English formats.',
      examples: UNSUPPORTED_EXAMPLES,
    };
  }

  // -------------------------------------------------------------
  // 1. GUEST COUNT UPDATES
  // -------------------------------------------------------------

  // Pattern: "add 50 guests", "increase guests by 50"
  const guestAddMatch = lower.match(
    /(?:add|increase|raise|bump)\s+(?:the\s+)?(?:guest\s+list|guests?|guest\s+count)?\s*(?:by\s+)?(\d+)(?:\s+guests?)?/i
  );
  if (
    guestAddMatch &&
    guestAddMatch[1] &&
    (lower.includes('guest') || guestAddMatch[0].includes('add'))
  ) {
    const delta = parseInt(guestAddMatch[1]!, 10);
    const current = profile?.guestCount ?? 200;
    const target = Math.min(5000, current + delta);
    return {
      intent: 'update_plan',
      reply: `I have prepared an update to increase your guest count from ${current} to ${target}. Review the proposed impact below:`,
      patch: { guestCount: target },
    };
  }

  // Pattern: "cut/reduce/decrease guests by 30"
  const guestCutByMatch = lower.match(
    /(?:cut|reduce|decrease|lower|drop)\s+(?:the\s+)?(?:guest\s+list|guests?|guest\s+count)\s+by\s+(\d+)/i
  );
  if (guestCutByMatch && guestCutByMatch[1]) {
    const delta = parseInt(guestCutByMatch[1]!, 10);
    const current = profile?.guestCount ?? 200;
    const target = Math.max(10, current - delta);
    return {
      intent: 'update_plan',
      reply: `I have prepared an update to reduce your guest count from ${current} to ${target}. Review the proposed impact below:`,
      patch: { guestCount: target },
    };
  }

  // Pattern: "cut/reduce/increase guests to 150", "guest count 200", "set guests to 150"
  const guestToMatch = lower.match(
    /(?:cut|reduce|decrease|increase|set|change|move|update)?\s*(?:the\s+)?(?:guest\s+list|guests?|guest\s+count)\s*(?:to\s*|=\s*|:\s*|\s+is\s+)(\d+)/i
  );
  if (guestToMatch && guestToMatch[1] && !guestAddMatch) {
    const target = Math.min(5000, Math.max(10, parseInt(guestToMatch[1]!, 10)));
    return {
      intent: 'update_plan',
      reply: `I have prepared an update to set your guest count to ${target}. Review the proposed impact below:`,
      patch: { guestCount: target },
    };
  }

  // Pattern: "guest count 200" or "guests 200"
  const guestDirectMatch = lower.match(/\b(?:guests?|guest\s+count)\s+(\d{2,4})\b/i);
  if (guestDirectMatch && guestDirectMatch[1]) {
    const target = Math.min(5000, Math.max(10, parseInt(guestDirectMatch[1]!, 10)));
    return {
      intent: 'update_plan',
      reply: `I have prepared an update to set your guest count to ${target}. Review the proposed impact below:`,
      patch: { guestCount: target },
    };
  }

  // -------------------------------------------------------------
  // 2. BUDGET UPDATES
  // -------------------------------------------------------------

  // Pattern: "increase budget by 5 lakh", "add 5 lakh to budget"
  const budgetAddMatch = lower.match(
    /(?:increase|add|raise|bump)\s+(?:the\s+)?(?:total\s+)?budget\s+by\s+(.+)/i
  );
  if (budgetAddMatch && budgetAddMatch[1]) {
    const parsedAmount = parseInrAmount(budgetAddMatch[1]);
    if (parsedAmount !== null && parsedAmount > 0) {
      const current = profile?.totalBudgetInr ?? 4_000_000;
      const target = current + parsedAmount;
      return {
        intent: 'update_plan',
        reply: `I have prepared an update to increase your total budget by ${formatInr(parsedAmount)} to ${formatInr(target)}. Review the rebalanced allocation below:`,
        patch: { totalBudgetInr: target },
      };
    }
  }

  // Pattern: "reduce budget by 2 lakh", "cut budget by 2 lakh"
  const budgetReduceMatch = lower.match(
    /(?:reduce|cut|decrease|lower|drop)\s+(?:the\s+)?(?:total\s+)?budget\s+by\s+(.+)/i
  );
  if (budgetReduceMatch && budgetReduceMatch[1]) {
    const parsedAmount = parseInrAmount(budgetReduceMatch[1]);
    if (parsedAmount !== null && parsedAmount > 0) {
      const current = profile?.totalBudgetInr ?? 4_000_000;
      const target = Math.max(10_000, current - parsedAmount);
      return {
        intent: 'update_plan',
        reply: `I have prepared an update to reduce your total budget by ${formatInr(parsedAmount)} to ${formatInr(target)}. Review the rebalanced allocation below:`,
        patch: { totalBudgetInr: target },
      };
    }
  }

  // Pattern: "budget to 30 lakh", "budget 30 lakh", "set budget to 30 lakh", "change budget to 30 lakh"
  const budgetToMatch = lower.match(
    /(?:set|change|move|update|increase|reduce)?\s*(?:the\s+)?(?:total\s+)?budget\s*(?:to\s*|=\s*|:\s*|\s+is\s+)(.+)/i
  );
  if (budgetToMatch && budgetToMatch[1] && !budgetAddMatch && !budgetReduceMatch) {
    const parsedAmount = parseInrAmount(budgetToMatch[1]);
    if (parsedAmount !== null && parsedAmount >= 10_000) {
      return {
        intent: 'update_plan',
        reply: `I have prepared an update to adjust your total budget to ${formatInr(parsedAmount)}. Review the rebalanced allocation below:`,
        patch: { totalBudgetInr: parsedAmount },
      };
    }
  }

  // Direct currency amount alone: e.g. "Rs 5,00,000", "2 crore", "30 lakh"
  const standaloneAmount = parseInrAmount(trimmed);
  if (standaloneAmount !== null && standaloneAmount >= 10_000) {
    return {
      intent: 'update_plan',
      reply: `I have prepared an update to adjust your total budget to ${formatInr(standaloneAmount)}. Review the rebalanced allocation below:`,
      patch: { totalBudgetInr: standaloneAmount },
    };
  }

  // -------------------------------------------------------------
  // 3. DATE UPDATES
  // -------------------------------------------------------------

  // Pattern: "move date to 2027-03-12", "move date to 12 Mar 2027", "change event date to 2027-04-15"
  const dateMatch = lower.match(
    /(?:move|change|set|update|postpone|shift)\s+(?:the\s+)?(?:event\s+)?date\s*(?:to\s*|=\s*|:\s*|\s+is\s+)(.+)/i
  );
  if (dateMatch && dateMatch[1]) {
    const parsedDate = parseFlexibleDate(dateMatch[1]);
    if (parsedDate) {
      if (isDateBefore(parsedDate, today)) {
        return {
          intent: 'unsupported',
          reply: `The requested date (${parsedDate}) is in the past. Please select a date starting tomorrow or later.`,
          examples: UNSUPPORTED_EXAMPLES,
        };
      }
      return {
        intent: 'update_plan',
        reply: `I have scheduled the celebration date shift to ${parsedDate}. Review the recalculated timeline milestones below:`,
        patch: { eventDate: parsedDate },
      };
    }
  }

  // Direct ISO date alone
  const directDate = parseFlexibleDate(trimmed);
  if (directDate) {
    if (!isDateBefore(directDate, today)) {
      return {
        intent: 'update_plan',
        reply: `I have scheduled the celebration date shift to ${directDate}. Review the recalculated timeline milestones below:`,
        patch: { eventDate: directDate },
      };
    }
  }

  // -------------------------------------------------------------
  // 4. VENUE TYPE UPDATES
  // -------------------------------------------------------------
  const venueMatch = lower.match(
    /(?:change|set|switch|move|update)?\s*(?:the\s+)?venue(?:\s+type)?\s*(?:to\s*|=\s*|:\s*|\s+is\s+)?\s*(lawn|banquet|resort|destination|home|community\s*hall|temple)/i
  );
  if (venueMatch && venueMatch[1]) {
    let vType = venueMatch[1].toLowerCase().replace(/\s+/g, '_');
    if (vType === 'communityhall') vType = 'community_hall';
    return {
      intent: 'update_plan',
      reply: `I have prepared an update to change your venue type to ${vType}. Review the budget adjustment below:`,
      patch: { venueType: vType },
    };
  }

  // -------------------------------------------------------------
  // 5. CELEBRATION QUESTIONS
  // -------------------------------------------------------------
  if (
    lower.includes('what should i book first') ||
    lower.includes('what to book first') ||
    lower.includes('book first') ||
    lower.includes('first priority')
  ) {
    return {
      intent: 'question',
      reply:
        'For an Indian celebration, your primary venue and lead caterer should always be booked first (typically 9 to 12 months ahead for weddings). Once the date and venue deposit are locked, secure your lead photographer/videographer and wedding priest/pandit for muhurat verification.',
    };
  }

  if (
    lower.includes('catering') ||
    lower.includes('food') ||
    lower.includes('menu') ||
    lower.includes('plate')
  ) {
    return {
      intent: 'question',
      reply:
        'Catering represents approximately 25% of your overall budget allocation. We calculate per-plate estimates based on your city tier and guest count. If you have Jain or vegan dietary requirements, ensure dedicated preparation counters and separate service lines are stipulated in vendor contracts.',
    };
  }

  if (lower.includes('photographer') || lower.includes('photo') || lower.includes('video')) {
    return {
      intent: 'question',
      reply:
        'Photography & videography typically accounts for 8% to 10% of total expenditure. Reserve your lead team early, verify whether drone permissions are required at your venue, and confirm same-day edit deliverables in writing.',
    };
  }

  if (lower.includes('contingency') || lower.includes('emergency') || lower.includes('reserve')) {
    return {
      intent: 'question',
      reply:
        'Our planning engine enforces a mandatory 5% safety floor for unpredicted contingencies (such as extra generator fuel, ritual samagri overruns, or local municipal clearance fees). We recommend keeping this unallocated until the final week.',
    };
  }

  if (
    lower.includes('when') ||
    lower.includes('how') ||
    lower.includes('why') ||
    lower.includes('tell me') ||
    lower.includes('recommend') ||
    lower.includes('tips') ||
    lower.endsWith('?')
  ) {
    return {
      intent: 'question',
      reply:
        'Based on your celebration blueprint, prioritize booking critical milestones before secondary vendor sourcing. You can adjust your guest count or budget at any time by asking, or explore the Timeline and Vendors checklist tabs for milestone-by-milestone guidance.',
    };
  }

  // -------------------------------------------------------------
  // 6. UNRECOGNIZED / UNSUPPORTED
  // -------------------------------------------------------------
  return {
    intent: 'unsupported',
    reply:
      "I couldn't match that request with a planning action or question. You can ask celebration questions or adjust plan parameters like guest count, budget, date, or venue.",
    examples: UNSUPPORTED_EXAMPLES,
  };
}
