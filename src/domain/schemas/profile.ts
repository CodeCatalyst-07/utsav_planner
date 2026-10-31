import '@/lib/zod-config';
import { z } from 'zod';
import { isDateAfter, isValidDateString } from '../dates';

export const EventTypeEnum = z.enum([
  'wedding',
  'birthday_kids',
  'birthday_adult',
  'community_festival',
]);
export type EventType = z.infer<typeof EventTypeEnum>;

export const CityTierEnum = z.enum(['tier1', 'tier2', 'tier3']);
export type CityTier = z.infer<typeof CityTierEnum>;

export const BudgetTierEnum = z.enum(['budget', 'mid', 'premium']);
export type BudgetTier = z.infer<typeof BudgetTierEnum>;

export const VenueTypeEnum = z.enum([
  'banquet',
  'lawn',
  'home',
  'community_hall',
  'hotel',
  'destination',
]);
export type VenueType = z.infer<typeof VenueTypeEnum>;

export const DietarySchema = z.object({
  veg: z
    .number()
    .int('Veg guests must be an integer')
    .min(0, 'Veg guests cannot be negative')
    .default(0),
  nonVeg: z
    .number()
    .int('Non-veg guests must be an integer')
    .min(0, 'Non-veg guests cannot be negative')
    .default(0),
  jain: z
    .number()
    .int('Jain guests must be an integer')
    .min(0, 'Jain guests cannot be negative')
    .default(0),
  vegan: z
    .number()
    .int('Vegan guests must be an integer')
    .min(0, 'Vegan guests cannot be negative')
    .default(0),
});
export type Dietary = z.infer<typeof DietarySchema>;

/**
 * Proportionally scales down dietary requirements if their sum exceeds the target guest count.
 * Uses the largest remainder (Hamilton) method to guarantee integer results that strictly
 * sum to <= targetGuestCount.
 */
export function scaleDietary(dietary: Dietary, targetGuestCount: number): Dietary {
  const sum =
    (dietary.veg || 0) + (dietary.nonVeg || 0) + (dietary.jain || 0) + (dietary.vegan || 0);
  if (sum <= targetGuestCount) {
    return dietary;
  }
  if (targetGuestCount <= 0) {
    return { veg: 0, nonVeg: 0, jain: 0, vegan: 0 };
  }
  const ratio = targetGuestCount / sum;
  const nonVeg = Math.floor((dietary.nonVeg || 0) * ratio);
  const jain = Math.floor((dietary.jain || 0) * ratio);
  const vegan = Math.floor((dietary.vegan || 0) * ratio);
  const veg = Math.floor((dietary.veg || 0) * ratio);

  const currentSum = veg + nonVeg + jain + vegan;
  const remainder = targetGuestCount - currentSum;

  const fractions = [
    { key: 'veg', frac: (dietary.veg || 0) * ratio - veg },
    { key: 'nonVeg', frac: (dietary.nonVeg || 0) * ratio - nonVeg },
    { key: 'jain', frac: (dietary.jain || 0) * ratio - jain },
    { key: 'vegan', frac: (dietary.vegan || 0) * ratio - vegan },
  ].sort((a, b) => b.frac - a.frac);

  const res: Dietary = { veg, nonVeg, jain, vegan };
  for (let i = 0; i < remainder; i++) {
    const item = fractions[i];
    if (item) {
      const k = item.key as keyof Dietary;
      res[k] = (res[k] || 0) + 1;
    }
  }

  const total = res.veg + res.nonVeg + res.jain + res.vegan;
  if (total > targetGuestCount) {
    res.veg = Math.max(0, res.veg - (total - targetGuestCount));
  }
  return res;
}

export const TogglesSchema = z.object({
  venueIncluded: z.boolean().default(false),
  includeAttireJewellery: z.boolean().default(true),
});
export type Toggles = z.infer<typeof TogglesSchema>;

/**
 * Strips control characters (except newline, return, and tab) and trims.
 */
export function sanitizeNotes(notes?: string | null): string | undefined {
  if (notes == null) {
    return undefined;
  }
  // Remove control characters (C0 & DEL), preserving newlines \r, \n, and \t
  const sanitized = notes.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  return sanitized.slice(0, 500);
}

export const BaseProfileSchema = z.object({
  eventType: EventTypeEnum,
  eventDate: z.string().refine(isValidDateString, {
    message: 'Event date must be a valid date in YYYY-MM-DD format',
  }),
  cityTier: CityTierEnum,
  cityName: z
    .string()
    .trim()
    .min(1, 'City name must be at least 1 character')
    .max(60, 'City name cannot exceed 60 characters')
    .optional(),
  guestCount: z
    .number()
    .int('Guest count must be an integer')
    .min(1, 'Guest count must be at least 1')
    .max(5000, 'Guest count cannot exceed 5,000'),
  totalBudgetInr: z
    .number()
    .int('Budget must be an integer in rupees')
    .min(10_000, 'Total budget must be at least ₹10,000')
    .max(500_000_000, 'Total budget cannot exceed ₹50,00,00,000'),
  budgetTier: BudgetTierEnum,
  venueType: VenueTypeEnum,
  functionsCount: z
    .number()
    .int('Functions count must be an integer')
    .min(1, 'Functions count must be at least 1')
    .max(6, 'Functions count cannot exceed 6')
    .default(1),
  dietary: DietarySchema.default({ veg: 0, nonVeg: 0, jain: 0, vegan: 0 }),
  toggles: TogglesSchema.default({ venueIncluded: false, includeAttireJewellery: true }),
  overrides: z
    .record(z.string(), z.number().int().min(0, 'Override amount must be non-negative'))
    .default({}),
  notes: z
    .string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .transform((val) => sanitizeNotes(val)),
});

export type RawEventProfile = z.infer<typeof BaseProfileSchema>;

export interface EventProfile extends RawEventProfile {
  functionsCount: number;
}

export interface ValidationError {
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: ValidationError[] };

/**
 * Validates an event profile against strict schema and dynamic "today" date context.
 * Never throws on bad input.
 */
export function validateProfile(input: unknown, today: string): ValidationResult<EventProfile> {
  if (!isValidDateString(today)) {
    return {
      ok: false,
      errors: [{ path: 'today', message: `Invalid "today" date string: ${String(today)}` }],
    };
  }

  const parseResult = BaseProfileSchema.safeParse(input);
  if (!parseResult.success) {
    const errors: ValidationError[] = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return { ok: false, errors };
  }

  const profile = parseResult.data;
  const errors: ValidationError[] = [];

  // Rule: eventDate must be > today
  if (!isDateAfter(profile.eventDate, today)) {
    errors.push({
      path: 'eventDate',
      message: `Event date (${profile.eventDate}) must be strictly in the future (after today: ${today})`,
    });
  }

  // Rule: functionsCount is wedding-only; forced to 1 for all other event types
  let effectiveFunctionsCount = profile.functionsCount;
  if (profile.eventType !== 'wedding') {
    effectiveFunctionsCount = 1;
  }

  // Rule: includeAttireJewellery is wedding-only; forced to false for non-weddings
  const effectiveToggles: Toggles = {
    venueIncluded: profile.toggles.venueIncluded,
    includeAttireJewellery:
      profile.eventType === 'wedding' ? profile.toggles.includeAttireJewellery : false,
  };

  // Rule: dietary count sum must not exceed guestCount
  const dietarySum =
    profile.dietary.veg + profile.dietary.nonVeg + profile.dietary.jain + profile.dietary.vegan;

  if (dietarySum > profile.guestCount) {
    errors.push({
      path: 'dietary',
      message: `Sum of specified dietary guests (${dietarySum}) cannot exceed total guest count (${profile.guestCount})`,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const validatedProfile: EventProfile = {
    ...profile,
    functionsCount: effectiveFunctionsCount,
    toggles: effectiveToggles,
  };

  return { ok: true, data: validatedProfile };
}

/**
 * Partial schema for re-planning modifications.
 */
export const ProfilePatchSchema = BaseProfileSchema.partial();
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;
export const eventProfileSchema = BaseProfileSchema;
export const EventProfileSchema = BaseProfileSchema;
