import 'server-only';
import { z } from 'zod';
import { eventProfileSchema, validateProfile } from '@/domain/schemas/profile';
import { buildPlan } from '@/domain/rules/plan';
import { indiaLocalePack } from '@/domain/config/in';
import { todayInIst } from '@/server/dates';
import { buildIcs } from '@/server/google/calendar';
import { getOrCreateRequestId } from '@/server/security/requestId';
import { createErrorResponse } from '@/server/security/logger';
import { parseRequestBody, nonLlmRateLimiter, checkRateLimit } from '@/server/apiHelper';

const IcsRequestSchema = z
  .object({
    profile: eventProfileSchema,
    excludeMilestoneIds: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req.headers);

  const rateLimitError = checkRateLimit(req, nonLlmRateLimiter, requestId);
  if (rateLimitError) return rateLimitError;

  const parsed = await parseRequestBody(req, IcsRequestSchema, requestId);
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

    const plan = buildPlan(valResult.data, today, indiaLocalePack);
    const excludeIds = new Set(parsed.data!.excludeMilestoneIds || []);
    const filteredPlan =
      excludeIds.size > 0
        ? {
            ...plan,
            timeline: {
              ...plan.timeline,
              milestones: plan.timeline.milestones.filter((m) => !excludeIds.has(m.id)),
            },
          }
        : plan;

    const icsContent = buildIcs(filteredPlan, valResult.data);

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="event-timeline.ics"',
        'x-request-id': requestId,
      },
    });
  } catch (err: unknown) {
    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      'Failed to generate ICS calendar file',
      requestId
    );
  }
}
