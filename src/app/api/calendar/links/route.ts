import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eventProfileSchema, validateProfile } from '@/domain/schemas/profile';
import { buildPlan } from '@/domain/rules/plan';
import { indiaLocalePack } from '@/domain/config/in';
import { todayInIst } from '@/server/dates';
import { googleCalendarUrl, googleCalendarCatchUpUrl } from '@/server/google/calendar';
import { getOrCreateRequestId } from '@/server/security/requestId';
import { createErrorResponse } from '@/server/security/logger';
import { parseRequestBody, nonLlmRateLimiter, checkRateLimit } from '@/server/apiHelper';

const CalendarLinksRequestSchema = z
  .object({
    profile: eventProfileSchema,
  })
  .strict();

export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req.headers);

  const rateLimitError = checkRateLimit(req, nonLlmRateLimiter, requestId);
  if (rateLimitError) return rateLimitError;

  const parsed = await parseRequestBody(req, CalendarLinksRequestSchema, requestId);
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

    const caughtUp = plan.timeline.milestones.filter((m) => m.catchUp);
    const normal = plan.timeline.milestones.filter((m) => !m.catchUp);

    const links = [];

    if (caughtUp.length > 0) {
      links.push({
        milestoneId: 'catch_up',
        title: `Catch-up: ${caughtUp.length} planning tasks to start now`,
        date: caughtUp[0]!.date,
        critical: caughtUp.some((m) => m.critical),
        phase: 'before' as const,
        googleCalendarUrl: googleCalendarCatchUpUrl(caughtUp, valResult.data),
      });
    }

    for (const m of normal) {
      links.push({
        milestoneId: m.id,
        title: m.title,
        date: m.date,
        critical: m.critical,
        phase: m.phase,
        googleCalendarUrl: googleCalendarUrl(m, valResult.data),
      });
    }

    return NextResponse.json(
      { links },
      {
        status: 200,
        headers: {
          'x-request-id': requestId,
        },
      }
    );
  } catch (err: unknown) {
    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      'Failed to generate Google Calendar links',
      requestId
    );
  }
}
