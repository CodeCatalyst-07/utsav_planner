export const flagMessages = {
  compressed_plan: (p: { minLeadDays: number; daysToEvent: number }) =>
    `Event timeline is compressed (${p.daysToEvent} days remaining vs ${p.minLeadDays} day recommendation). Certain critical vendors may have limited availability.`,
  peak_season: (p: { factor: number }) =>
    `Event scheduled during peak celebration season. High vendor demand and estimated ${Math.round((p.factor - 1) * 100)}% seasonal price adjustments apply.`,
  monsoon_outdoor: (p: { venueType: string }) =>
    `Outdoor venue (${p.venueType}) planned during the Indian monsoon window (June-September). Waterproof canopy or backup indoor hall strongly recommended.`,
  catering_over: (p: { allocation: string; midEstimate: string; deficit: string }) =>
    `Estimated catering costs (${p.midEstimate}) exceed the allocated budget (${p.allocation}) by ${p.deficit}.`,
  catering_tight: (p: { allocation: string; highEstimate: string; budgetTier: string }) =>
    `Catering allocation (${p.allocation}) is tight for ${p.budgetTier} tier (peak band reaches ${p.highEstimate}). Consider guest count or tier adjustments.`,
  per_head_budget_low: (p: { perHead: string; minThreshold: string }) =>
    `Total budget per guest (${p.perHead}) is below the typical baseline threshold (${p.minThreshold}) for this celebration type.`,
  contingency_below_floor: (p: { actualPercent: number; floorPercent: number }) =>
    `Contingency reserve is currently at ${p.actualPercent.toFixed(1)}%, which is below the recommended ${p.floorPercent}% safety floor.`,
  special_diet_counters: (p: { detail: string }) =>
    `Special dietary requirements specified (${p.detail}). Dedicated preparation counters or labeled buffet sections advised.`,
  wedding_muhurat_verify: () =>
    `Confirm final ceremony timings and muhurat with your family priest or regional panchang. This application provides scheduling assistance, not astrological or religious endorsements.`,
  community_permissions_verify: () =>
    `Public and society festivals require clearances from local municipal bodies, police stations, electricity providers, and fire safety officers. Confirm jurisdiction-specific rules locally.`,
  catch_up_needed: (p: { count: number; criticalCount: number }) =>
    `Catch-up required: ${p.count} planning milestone${p.count === 1 ? '' : 's'} (${p.criticalCount} critical) were scheduled before today and need immediate attention.`,
};

export type FlagCode = keyof typeof flagMessages;
