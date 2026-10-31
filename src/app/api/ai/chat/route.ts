import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eventProfileSchema, validateProfile, ProfilePatchSchema } from '@/domain/schemas/profile';
import { buildPlan } from '@/domain/rules/plan';
import { replan } from '@/domain/rules/replan';
import { indiaLocalePack } from '@/domain/config/in';
import { todayInIst } from '@/server/dates';
import { getOrCreateRequestId } from '@/server/security/requestId';
import { createErrorResponse } from '@/server/security/logger';
import { parseRequestBody, llmRateLimiter, checkRateLimit } from '@/server/apiHelper';
import { FailoverChain } from '@/server/ai/chain';
import { sectionSchemas, ChatIntentSection, NarrateDiffSection } from '@/server/ai/sections';
import { buildChatIntentPrompt, buildNarrateDiffPrompt } from '@/server/ai/prompts';
import { DeterministicFallback } from '@/server/ai/fallback';

export const maxDuration = 30;

const ChatRequestSchema = z
  .object({
    profile: eventProfileSchema,
    message: z.string().trim().min(1).max(500),
  })
  .strict();

const defaultChain = new FailoverChain();

export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req.headers);

  const rateLimitError = checkRateLimit(req, llmRateLimiter, requestId);
  if (rateLimitError) return rateLimitError;

  const parsed = await parseRequestBody(req, ChatRequestSchema, requestId);
  if (parsed.errorResponse) return parsed.errorResponse;

  const { profile, message } = parsed.data!;
  const forceProvider = req.headers.get('x-force-provider');

  try {
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
    const currentPlan = buildPlan(validatedProfile, today, indiaLocalePack);
    const allowedCategoryIds = currentPlan.budget.lines.map((l) => l.id);

    // 1. Parse user intent with chat_intent section
    const intentResult = await defaultChain.executeSection<ChatIntentSection>({
      section: 'chat_intent',
      schema: sectionSchemas.chat_intent,
      promptBuilder: () => buildChatIntentPrompt(validatedProfile, message),
      fallbackGetter: () => DeterministicFallback.getChatIntent(message, validatedProfile, today),
      validationContext: { profile: validatedProfile, allowedCategoryIds, userMessage: message },
      profile: validatedProfile,
      forceProvider,
      requestId,
    });

    const intentData = intentResult.data;

    // 2. If intent is update_plan and contains a patch, execute deterministic replan + narrate diff
    if (intentData.intent === 'update_plan' && intentData.patch) {
      const patchValidation = ProfilePatchSchema.safeParse(intentData.patch);

      if (patchValidation.success && Object.keys(patchValidation.data).length > 0) {
        const replanResult = replan(currentPlan, patchValidation.data, today, indiaLocalePack);

        if (replanResult.ok) {
          // Engine replanned successfully; now narrate the engine-computed diff
          const narrateResult = await defaultChain.executeSection<NarrateDiffSection>({
            section: 'narrate_diff',
            schema: sectionSchemas.narrate_diff,
            promptBuilder: () => buildNarrateDiffPrompt(replanResult.diff),
            fallbackGetter: () => DeterministicFallback.getNarrateDiff(replanResult.diff),
            validationContext: {
              profile: validatedProfile,
              diff: replanResult.diff,
              allowedCategoryIds,
            },
            profile: validatedProfile,
            diff: replanResult.diff,
            forceProvider,
            requestId,
          });

          return NextResponse.json(
            {
              reply: narrateResult.data.narration,
              patch: patchValidation.data,
              diff: replanResult.diff,
              plan: replanResult.plan,
              meta: intentResult.meta,
            },
            {
              status: 200,
              headers: {
                'x-request-id': requestId,
              },
            }
          );
        }
      }
    }

    // Question or unsupported intent, or empty patch: return conversational reply
    return NextResponse.json(
      {
        reply: intentData.reply,
        meta: intentResult.meta,
      },
      {
        status: 200,
        headers: {
          'x-request-id': requestId,
        },
      }
    );
  } catch (err: unknown) {
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to process chat message', requestId);
  }
}
