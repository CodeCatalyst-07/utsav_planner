import { z } from 'zod';
import { LocalePack } from '../types';
import { indiaLocaleData } from './data';

const BudgetSplitCategorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().int().min(0).max(100),
  source: z.literal('assumption'),
});

const CateringBandSchema = z
  .object({
    min: z.number().int().min(0),
    max: z.number().int().min(0),
    source: z.literal('assumption'),
  })
  .refine((data) => data.min <= data.max, {
    message: 'Catering band min must be less than or equal to max',
  });

const MilestoneDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  offset: z.number().int(),
  category: z.string().min(1),
  critical: z.boolean(),
  verifyNote: z.string().optional(),
  source: z.literal('assumption'),
});

const VendorChecklistTemplateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  budgetCategory: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
  leadDays: z.number().int().min(0),
  mapsQueryTemplate: z.string().min(1),
  source: z.literal('assumption'),
});

const ConditionalChecklistRuleSchema = z.object({
  id: z.string().min(1),
  condition: z.enum([
    'destination_venue',
    'monsoon_outdoor',
    'jain_dietary',
    'vegan_dietary',
    'kids_birthday_safety',
    'multi_function_wedding',
  ]),
  item: VendorChecklistTemplateSchema,
  note: z.string().optional(),
});

export const LocalePackSchema = z.object({
  locale: z.string().min(1),
  countryName: z.string().min(1),
  currency: z.string().min(1),
  contingencyFloorPercent: z.number().int().min(0).max(100),
  minLeadDays: z.record(z.string(), z.number().int().min(0)),
  budgetSplits: z.record(
    z.string(),
    z.array(BudgetSplitCategorySchema).refine(
      (categories) => {
        const sum = categories.reduce((acc, cat) => acc + cat.weight, 0);
        return sum === 100;
      },
      { message: 'Budget split weights must sum to exactly 100%' }
    )
  ),
  cateringBands: z.record(z.string(), z.record(z.string(), CateringBandSchema)),
  communityFestivalCateringBand: CateringBandSchema,
  cateringEventTypeMultipliers: z.object({
    weddingBase: z.number().min(0),
    weddingSubsequentFunctionMultiplier: z.number().min(0),
    birthdayAdult: z.number().min(0),
    birthdayKids: z.number().min(0),
  }),
  seasonRules: z.object({
    weddingPeakMonths: z.array(z.number().int().min(1).max(12)),
    weddingPeakFactor: z.number().min(1),
    monsoonMonths: z.array(z.number().int().min(1).max(12)),
    outdoorVenues: z.array(z.string()),
  }),
  perHeadThresholds: z.object({
    weddingMinBudgetPerHead: z.number().int().min(0),
    birthdayMinBudgetPerHead: z.number().int().min(0),
    communityFestivalMinBudgetPerHead: z.number().int().min(0),
  }),
  milestones: z.record(z.string(), z.array(MilestoneDefinitionSchema)),
  vendorChecklists: z.record(z.string(), z.array(VendorChecklistTemplateSchema)),
  conditionalRules: z.array(ConditionalChecklistRuleSchema),
});

/**
 * Validates and loads the India Locale Pack.
 * Throws at initialization if data violates invariants.
 */
function loadIndiaLocalePack(): LocalePack {
  const result = LocalePackSchema.safeParse(indiaLocaleData);
  if (!result.success) {
    const errorMessages = result.error.issues
      .map((i) => `  [${i.path.join('.')}]: ${i.message}`)
      .join('\n');
    throw new Error(`Failed to validate India Locale Pack:\n${errorMessages}`);
  }
  return result.data as unknown as LocalePack;
}

export const indiaLocalePack: LocalePack = loadIndiaLocalePack();
export * from './fallbacks';
export * from './dietary';
