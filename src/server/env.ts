import 'server-only';
import { z } from 'zod';

const booleanFlag = (defaultValue: boolean) =>
  z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return defaultValue;
      if (typeof val === 'string') {
        const lower = val.toLowerCase().trim();
        return lower === 'true' || lower === '1';
      }
      return Boolean(val);
    }, z.boolean())
    .default(defaultValue);

const optionalString = () =>
  z.preprocess((val) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
  }, z.string().trim().min(1).optional());

const optionalNumber = (defaultValue?: number) =>
  z.preprocess(
    (val) => {
      if (val === undefined || val === null) return defaultValue;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return defaultValue;
        const num = Number(trimmed);
        return isNaN(num) ? val : num;
      }
      return val;
    },
    defaultValue !== undefined
      ? z.number().int().min(0).default(defaultValue)
      : z.number().int().min(0).optional()
  );

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    JARVISLABS_API_KEY: optionalString(),
    JARVIS_BASE_URL: z.string().trim().url().default('https://models.jarvislabs.net/v1'),
    JARVIS_MODEL: z.string().trim().min(1).default('gemma-4-31b-it'),
    JARVIS_JSON_MODE: z.enum(['prompt_only', 'response_format']).default('prompt_only'),
    JARVIS_EXTRA_BODY_JSON: z
      .preprocess((val) => {
        if (val === undefined || val === null) return {};
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === '') return {};
          try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              return parsed;
            }
            return 'INVALID_JSON_OBJECT';
          } catch {
            return 'INVALID_JSON_SYNTAX';
          }
        }
        return val;
      }, z.record(z.string(), z.unknown()).default({}))
      .default({}),
    GEMINI_API_KEY: optionalString(),
    GEMINI_MODEL: optionalString(),
    GEMINI_THINKING_BUDGET: optionalNumber(),
    VENDOR_SOURCE: z.enum(['sample', 'places']).default('sample'),
    GOOGLE_PLACES_API_KEY: optionalString(),
    RATE_LIMIT_PER_MIN: optionalNumber(10),
    LLM_TIMEOUT_MS: optionalNumber(20000),
    AI_TOTAL_DEADLINE_MS: optionalNumber(15000),
    AI_CACHE_TTL_SECONDS: optionalNumber(1800),
    CRITIC_ENABLED: booleanFlag(false),
    GROUNDING_ENABLED: booleanFlag(false),
    ALLOW_PROVIDER_OVERRIDE: booleanFlag(false),
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
  const hasGemini = Boolean(
    config.GEMINI_API_KEY &&
    config.GEMINI_API_KEY.trim().length > 0 &&
    config.GEMINI_MODEL &&
    config.GEMINI_MODEL.trim().length > 0
  );
  const hasJarvis = Boolean(
    config.JARVISLABS_API_KEY && config.JARVISLABS_API_KEY.trim().length > 0
  );
  const hasPlaces = Boolean(
    config.GOOGLE_PLACES_API_KEY && config.GOOGLE_PLACES_API_KEY.trim().length > 0
  );

  return {
    gemini: hasGemini,
    jarvis: hasJarvis,
    googlePlaces: hasPlaces,
  };
}
