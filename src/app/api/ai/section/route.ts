import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eventProfileSchema, validateProfile } from '@/domain/schemas/profile';
import { buildPlan } from '@/domain/rules/plan';
import { indiaLocalePack } from '@/domain/config/in';
import { todayInIst } from '@/server/dates';
import { getOrCreateRequestId } from '@/server/security/requestId';
import { createErrorResponse } from '@/server/security/logger';
import { parseRequestBody, llmRateLimiter, checkRateLimit } from '@/server/apiHelper';
import { FailoverChain } from '@/server/ai/chain';
import {
  sectionSchemas,
  SectionType,
  IdeasSection,
  CategoryTipsSection,
  MenuSection,
  NarrateDiffSection,
} from '@/server/ai/sections';
import {
  buildIdeasPrompt,
  buildCategoryTipsPrompt,
  buildMenuPrompt,
  buildNarrateDiffPrompt,
} from '@/server/ai/prompts';
import { DeterministicFallback } from '@/server/ai/fallback';
import { PlanDiff } from '@/domain/rules/replan';

export const maxDuration = 30;

const SectionRequestSchema = z
  .object({
    profile: eventProfileSchema,
    section: z.enum(['ideas', 'category_tips', 'menu', 'narrate_diff']),
    diff: z
      .object({
        summaryFacts: z.array(z.string()),
        totalDelta: z.number().optional(),
        flagsAdded: z.array(z.string()).optional(),
        flagsRemoved: z.array(z.string()).optional(),
        milestonesShifted: z
          .array(
            z.object({
              id: z.string(),
              oldDate: z.string(),
              newDate: z.string(),
              daysDiff: z.number(),
            })
          )
          .optional(),
        checklistAdded: z.array(z.string()).optional(),
        checklistRemoved: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .strict();

const defaultChain = new FailoverChain();

export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req.headers);

  const rateLimitError = checkRateLimit(req, llmRateLimiter, requestId);
  if (rateLimitError) return rateLimitError;

  const parsed = await parseRequestBody(req, SectionRequestSchema, requestId);
  if (parsed.errorResponse) return parsed.errorResponse;

  const { profile, section, diff } = parsed.data!;
  const forceProvider = req.headers.get('x-force-provider');

  try {
    // 1. Build plan deterministically server-side (never trust client-sent numbers or categories)
    const today = todayInIst();
    const valResult = validateProfile(profile, today);
    if (!valResult.ok) {
      return createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Profile validation failed',
        requestId,
        undefined,
        valResult.errors
      );
    }
    const validatedProfile = valResult.data;
    const plan = buildPlan(validatedProfile, today, indiaLocalePack);
    const allowedCategoryIds = plan.budget.lines.map((l) => l.id);

    let result: { data: unknown; meta: unknown };

    switch (section) {
      case 'ideas': {
        result = await defaultChain.executeSection<IdeasSection>({
          section: 'ideas',
          schema: sectionSchemas.ideas,
          promptBuilder: () => buildIdeasPrompt(validatedProfile),
          fallbackGetter: () => DeterministicFallback.getIdeas(validatedProfile),
          validationContext: { profile: validatedProfile, allowedCategoryIds },
          profile: validatedProfile,
          forceProvider,
          requestId,
        });
        break;
      }
      case 'category_tips': {
        result = await defaultChain.executeSection<CategoryTipsSection>({
          section: 'category_tips',
          schema: sectionSchemas.category_tips,
          promptBuilder: () => buildCategoryTipsPrompt(validatedProfile, allowedCategoryIds),
          fallbackGetter: () =>
            DeterministicFallback.getCategoryTips(validatedProfile, allowedCategoryIds),
          validationContext: { profile: validatedProfile, allowedCategoryIds },
          profile: validatedProfile,
          forceProvider,
          requestId,
        });
        break;
      }
      case 'menu': {
        result = await defaultChain.executeSection<MenuSection>({
          section: 'menu',
          schema: sectionSchemas.menu,
          promptBuilder: () => buildMenuPrompt(validatedProfile),
          fallbackGetter: () => DeterministicFallback.getMenu(validatedProfile),
          validationContext: { profile: validatedProfile, allowedCategoryIds },
          profile: validatedProfile,
          forceProvider,
          requestId,
        });
        break;
      }
      case 'narrate_diff': {
        const dummyDiff: PlanDiff = diff
          ? {
              budgetLines: [],
              cateringEstimateDelta: 0,
              totalDelta: diff.totalDelta ?? 0,
              flagsAdded: diff.flagsAdded ?? [],
              flagsRemoved: diff.flagsRemoved ?? [],
              milestonesShifted: (diff.milestonesShifted ?? []).map((m) => ({
                id: m.id,
                beforeDate: m.oldDate,
                afterDate: m.newDate,
                daysDelta: m.daysDiff,
              })),
              checklistAdded: diff.checklistAdded ?? [],
              checklistRemoved: diff.checklistRemoved ?? [],
              summaryFacts: diff.summaryFacts,
            }
          : {
              budgetLines: [],
              cateringEstimateDelta: 0,
              summaryFacts: ['Event plan established with baseline parameters'],
              totalDelta: 0,
              flagsAdded: [],
              flagsRemoved: [],
              milestonesShifted: [],
              checklistAdded: [],
              checklistRemoved: [],
            };

        result = await defaultChain.executeSection<NarrateDiffSection>({
          section: 'narrate_diff',
          schema: sectionSchemas.narrate_diff,
          promptBuilder: () => buildNarrateDiffPrompt(dummyDiff),
          fallbackGetter: () => DeterministicFallback.getNarrateDiff(dummyDiff),
          validationContext: {
            profile: validatedProfile,
            diff: dummyDiff,
            allowedCategoryIds,
          },
          profile: validatedProfile,
          diff: dummyDiff,
          forceProvider,
          requestId,
        });
        break;
      }
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'x-request-id': requestId,
      },
    });
  } catch (err: unknown) {
    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      `Failed to generate AI section "${section}"`,
      requestId
    );
  }
}
