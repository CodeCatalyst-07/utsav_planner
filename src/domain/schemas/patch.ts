import { z } from 'zod';
import { BaseProfileSchema } from './profile';
import { isValidDateString } from '../dates';

/**
 * EventProfilePatchSchema
 * Validates partial updates to an EventProfile with strict domain bounds:
 * - guestCount: int between 1 and 5,000
 * - totalBudgetInr: int between 10,000 and 500,000,000
 * - eventDate: valid future date string
 * - .strict(): rejects unknown keys (e.g. isAdmin, roles, bypass)
 */
export const EventProfilePatchSchema = BaseProfileSchema.partial()
  .strict()
  .superRefine((data, ctx) => {
    if (data.eventDate !== undefined) {
      if (!isValidDateString(data.eventDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['eventDate'],
          message: 'Patch eventDate must be a valid date in YYYY-MM-DD format',
        });
      }
    }
  });

export type EventProfilePatch = z.infer<typeof EventProfilePatchSchema>;
