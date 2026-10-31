import 'server-only';
import '@/lib/zod-config';
import { ZodSchema } from 'zod';
import { TokenBucketRateLimiter, getClientIp } from './security/rateLimit';
import { getOrCreateRequestId } from './security/requestId';
import { createErrorResponse } from './security/logger';
import { getEnv } from './env';

// In-memory rate limiters
// LLM limiter initialized with RATE_LIMIT_PER_MIN
export const llmRateLimiter = new TokenBucketRateLimiter({
  limit: 10,
  windowMs: 60_000,
  dailyLimit: 150,
});

// Non-LLM generous limiter (60/min)
export const nonLlmRateLimiter = new TokenBucketRateLimiter({
  limit: 60,
  windowMs: 60_000,
  dailyLimit: 2000,
});

/**
 * Checks rate limits for incoming requests.
 * Returns null if allowed, or a 429 NextResponse if rate limit exceeded.
 */
export function checkRateLimit(req: Request, limiter: TokenBucketRateLimiter, requestId: string) {
  const clientIp = getClientIp(req.headers);
  const result = limiter.check(clientIp);

  if (!result.allowed) {
    return createErrorResponse(
      429,
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Please retry in ${result.retryAfterSeconds} seconds.`,
      requestId,
      {
        'Retry-After': String(result.retryAfterSeconds),
      }
    );
  }

  return null;
}

/**
 * Reads and parses JSON body with strict size cap (default 16KB) and Zod schema validation.
 */
export async function parseRequestBody<T>(
  req: Request,
  schema: ZodSchema<T>,
  requestId: string,
  maxSizeBytes = 16 * 1024
): Promise<{ data?: T; errorResponse?: ReturnType<typeof createErrorResponse> }> {
  // Check Content-Length header first
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
    return {
      errorResponse: createErrorResponse(
        413,
        'PAYLOAD_TOO_LARGE',
        `Request body exceeds maximum allowed size of ${maxSizeBytes} bytes`,
        requestId
      ),
    };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return {
      errorResponse: createErrorResponse(
        400,
        'BAD_REQUEST',
        'Failed to read request body stream',
        requestId
      ),
    };
  }

  const byteLength = Buffer.byteLength(text, 'utf-8');
  if (byteLength > maxSizeBytes) {
    return {
      errorResponse: createErrorResponse(
        413,
        'PAYLOAD_TOO_LARGE',
        `Request body size (${byteLength} bytes) exceeds limit of ${maxSizeBytes} bytes`,
        requestId
      ),
    };
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(text);
  } catch {
    return {
      errorResponse: createErrorResponse(
        400,
        'INVALID_JSON',
        'Request body must be valid JSON',
        requestId
      ),
    };
  }

  const parseResult = schema.safeParse(rawJson);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));

    return {
      errorResponse: createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        requestId,
        undefined,
        errorDetails
      ),
    };
  }

  return { data: parseResult.data };
}
