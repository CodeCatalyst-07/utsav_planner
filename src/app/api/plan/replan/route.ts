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
import { parseRequestBody, nonLlmRateLimiter, checkRateLimit } from '@/server/apiHelper';

const ReplanRequestSchema = z
  .object({
    profile: eventProfileSchema,
    patch: ProfilePatchSchema,
  })
  .strict();

export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req.headers);

  const rateLimitError = checkRateLimit(req, nonLlmRateLimiter, requestId);
  if (rateLimitError) return rateLimitError;

  const parsed = await parseRequestBody(req, ReplanRequestSchema, requestId);
  if (parsed.errorResponse) return parsed.errorResponse;

  try {
    const today = todayInIst();
    const valResult = validateProfile(parsed.data!.profile, today);
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

    const currentPlan = buildPlan(valResult.data, today, indiaLocalePack);
    const result = replan(currentPlan, parsed.data!.patch, today, indiaLocalePack);

    if (!result.ok) {
      return createErrorResponse(
        400,
        'INVALID_PATCH',
        'Profile patch validation failed',
        requestId,
        undefined,
        result.errors
      );
    }

    return NextResponse.json(
      {
        plan: result.plan,
        diff: result.diff,
      },
      {
        status: 200,
        headers: {
          'x-request-id': requestId,
        },
      }
    );
  } catch (err: unknown) {
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Failed to compute replan', requestId);
  }
}
