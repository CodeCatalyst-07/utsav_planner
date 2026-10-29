import 'server-only';
import { z } from 'zod';

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    JARVISLABS_API_KEY: z.string().trim().min(1).optional(),
    JARVIS_BASE_URL: z.string().trim().url().default('https://models.jarvislabs.net/v1'),
    JARVIS_MODEL: z.string().trim().min(1).default('gemma-4-31b-it'),
    GEMINI_API_KEY: z.string().trim().min(1).optional(),
    GEMINI_MODEL: z.string().trim().min(1).optional(),
    VENDOR_SOURCE: z.enum(['sample', 'places', 'gemini']).default('sample'),
    GOOGLE_PLACES_API_KEY: z.string().trim().min(1).optional(),
    RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(10),
  })
  .superRefine((data, ctx) => {
    // GEMINI_MODEL is required only if GEMINI_API_KEY is provided
    if (data.GEMINI_API_KEY && !data.GEMINI_MODEL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GEMINI_MODEL'],
        message: 'GEMINI_MODEL is required when GEMINI_API_KEY is set',
      });
    }

    // GOOGLE_PLACES_API_KEY is required only when VENDOR_SOURCE=places
    if (data.VENDOR_SOURCE === 'places' && !data.GOOGLE_PLACES_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_PLACES_API_KEY'],
        message: 'GOOGLE_PLACES_API_KEY is required when VENDOR_SOURCE is "places"',
      });
    }
  });

export type EnvConfig = z.infer<typeof rawEnvSchema>;

/**
 * Parses and validates environment variables.
 * Emits error messages listing variable NAMES ONLY; never prints variable values.
 */
export function parseEnv(raw: Record<string, unknown>): EnvConfig {
  const result = rawEnvSchema.safeParse(raw);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => {
        const fieldName = issue.path.join('.') || 'configuration';
        return `  - ${fieldName}: ${issue.message}`;
      })
      .join('\n');

    throw new Error(
      `Invalid environment configuration. Missing or invalid variables:\n${errorDetails}`
    );
  }

  return result.data;
}

let cachedEnv: EnvConfig | null = null;

/**
 * Lazy memoized getter for application environment.
 * Ensures build, CI, test, and container start without requiring secret keys.
 */
export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}

/**
 * Resets memoized env cache (useful for isolated unit testing).
 */
export function _resetEnvCacheForTesting(): void {
  cachedEnv = null;
}

export interface ConfiguredProviders {
  gemini: boolean;
  jarvis: boolean;
  googlePlaces: boolean;
}

export function getConfiguredProviders(config = getEnv()): ConfiguredProviders {
  return {
    gemini: Boolean(config.GEMINI_API_KEY && config.GEMINI_MODEL),
    jarvis: Boolean(config.JARVISLABS_API_KEY),
    googlePlaces: Boolean(config.GOOGLE_PLACES_API_KEY),
  };
}
