import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getVendorSource } from '@/server/vendors';
import { getOrCreateRequestId } from '@/server/security/requestId';
import { createErrorResponse } from '@/server/security/logger';
import { nonLlmRateLimiter, checkRateLimit } from '@/server/apiHelper';
import { CityTierEnum } from '@/domain/schemas/profile';

const VendorQuerySchema = z.object({
  categoryId: z.string().trim().min(1),
  city: z.string().trim().optional(),
  tier: CityTierEnum.optional(),
  label: z.string().trim().optional(),
});

export async function GET(req: Request) {
  const requestId = getOrCreateRequestId(req.headers);

  const rateLimitError = checkRateLimit(req, nonLlmRateLimiter, requestId);
  if (rateLimitError) return rateLimitError;

  const url = new URL(req.url);
  const rawQuery = {
    categoryId: url.searchParams.get('categoryId') || '',
    city: url.searchParams.get('city') || undefined,
    tier: url.searchParams.get('tier') || undefined,
    label: url.searchParams.get('label') || undefined,
  };

  const parsed = VendorQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return createErrorResponse(
      400,
      'VALIDATION_ERROR',
      'Invalid vendor search parameters',
      requestId,
      undefined,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    );
  }

  const { categoryId, city, tier, label } = parsed.data;

  try {
    const vendorSource = getVendorSource();
    const result = await vendorSource.search({
      categoryId,
      label: label || categoryId,
      cityName: city,
      cityTier: tier,
    });

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
      'Failed to search vendor directory',
      requestId
    );
  }
}
