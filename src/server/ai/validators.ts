import 'server-only';
import { ZodSchema } from 'zod';
import { EventProfile } from '@/domain/schemas/profile';
import { PlanDiff } from '@/domain/rules/replan';
import { NON_VEG_KEYWORDS, JAIN_PROHIBITED_ROOT_KEYWORDS } from '@/domain/config/in/dietary';
import { getEnv } from '@/server/env';

export interface ValidationContext {
  profile?: EventProfile;
  diff?: PlanDiff;
  allowedCategoryIds?: string[];
  configuredSecrets?: string[];
  userMessage?: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
}

/**
 * Parses numeric text including Indian currency groupings, lakhs, and crores into integer rupee/count values.
 */
export function parseNumberValue(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]|Rs\.?|INR/gi, '').toLowerCase();

  if (cleaned.endsWith('crore') || cleaned.endsWith('cr')) {
    const num = parseFloat(cleaned.replace(/crore|cr/, ''));
    return isNaN(num) ? null : Math.round(num * 10_000_000);
  }

  if (cleaned.endsWith('lakh') || cleaned.endsWith('lac') || cleaned.endsWith('l')) {
    const num = parseFloat(cleaned.replace(/lakh|lac|l/, ''));
    return isNaN(num) ? null : Math.round(num * 100_000);
  }

  if (cleaned.endsWith('k')) {
    const num = parseFloat(cleaned.replace(/k/, ''));
    return isNaN(num) ? null : Math.round(num * 1_000);
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : Math.round(parsed);
}

/**
 * Extracts all allowed numbers from profile counts and diff facts.
 */
export function extractAllowedNumbers(context: ValidationContext): Set<number> {
  const allowed = new Set<number>();

  // Structural small constants (for themes count, course item limits, etc.)
  for (let i = 1; i <= 6; i++) {
    allowed.add(i);
  }

  if (context.profile) {
    const p = context.profile;
    allowed.add(p.guestCount);
    allowed.add(p.functionsCount);
    allowed.add(p.totalBudgetInr);
    allowed.add(p.dietary.veg);
    allowed.add(p.dietary.nonVeg);
    allowed.add(p.dietary.jain);
    allowed.add(p.dietary.vegan);

    // Event date year/month/day
    if (p.eventDate) {
      const [year, month, day] = p.eventDate.split('-').map(Number);
      if (year) allowed.add(year);
      if (month) allowed.add(month);
      if (day) allowed.add(day);
    }
  }

  if (context.diff) {
    if (context.diff.totalDelta !== undefined) {
      allowed.add(Math.abs(context.diff.totalDelta));
    }
    // Extract any number present in diff summaryFacts
    for (const fact of context.diff.summaryFacts) {
      const matches =
        fact.match(/(?:₹|Rs\.?|INR)?\s*\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:lakh|crore|cr|lac|k))?/gi) ||
        [];
      for (const m of matches) {
        const val = parseNumberValue(m);
        if (val !== null) allowed.add(val);
      }
    }
  }

  if (context.userMessage) {
    const matches =
      context.userMessage.match(
        /(?:₹|Rs\.?|INR)?\s*\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:lakh|crore|cr|lac|k))?/gi
      ) || [];
    for (const m of matches) {
      const val = parseNumberValue(m);
      if (val !== null) allowed.add(val);
    }
  }

  return allowed;
}

/**
 * Extracts prose strings from any arbitrary parsed JSON object.
 */
function extractProseStrings(obj: unknown): string[] {
  const strings: string[] = [];
  function recurse(val: unknown) {
    if (typeof val === 'string') {
      strings.push(val);
    } else if (Array.isArray(val)) {
      for (const item of val) recurse(item);
    } else if (val && typeof val === 'object') {
      for (const v of Object.values(val as Record<string, unknown>)) recurse(v);
    }
  }
  recurse(obj);
  return strings;
}

/**
 * Validates parsed LLM JSON output against schema, semantic category rules,
 * numeric bounds (numeric guard), banned commercial claims, and secret leakage.
 */
export function validateOutput<T>(
  rawJson: unknown,
  schema: ZodSchema<T>,
  context: ValidationContext = {}
): ValidationResult<T> {
  // 1. Zod schema validation
  const schemaResult = schema.safeParse(rawJson);
  if (!schemaResult.success) {
    const issueMessages = schemaResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return {
      valid: false,
      error: `Schema validation failed: ${issueMessages}`,
    };
  }

  const data = schemaResult.data;
  const proseStrings = extractProseStrings(data);
  const combinedProse = proseStrings.join(' ');

  // 2. Secret Leak Scan
  const secretsToCheck: string[] = [];
  if (context.configuredSecrets) {
    secretsToCheck.push(...context.configuredSecrets);
  } else {
    try {
      const env = getEnv();
      if (env.JARVISLABS_API_KEY) secretsToCheck.push(env.JARVISLABS_API_KEY);
      if (env.GEMINI_API_KEY) secretsToCheck.push(env.GEMINI_API_KEY);
      if (env.GOOGLE_PLACES_API_KEY) secretsToCheck.push(env.GOOGLE_PLACES_API_KEY);
    } catch {
      // Env not initialized or in unit test
    }
  }

  for (const secret of secretsToCheck) {
    if (secret && secret.length >= 8 && combinedProse.includes(secret)) {
      return {
        valid: false,
        error: 'Security violation: Output contains configured secret or credential',
      };
    }
  }

  // 3. Banned Claims, Fake Phone Numbers, and Fake URLs
  if (/\bguaranteed\b/i.test(combinedProse)) {
    return { valid: false, error: 'Prohibited claim: output contains "guaranteed"' };
  }
  if (/\bbest\s+price\b/i.test(combinedProse)) {
    return { valid: false, error: 'Prohibited claim: output contains "best price"' };
  }
  if (/(?:\+91[-\s]?)?[6-9]\d{9}\b/.test(combinedProse)) {
    return { valid: false, error: 'Prohibited content: output contains a synthetic phone number' };
  }
  if (/https?:\/\/[^\s]+/i.test(combinedProse) || /\bwww\.[^\s]+/i.test(combinedProse)) {
    return { valid: false, error: 'Prohibited content: output contains a synthetic URL' };
  }

  // 4. Semantic Category Check (for category_tips)
  if (data && typeof data === 'object' && 'tips' in data && Array.isArray((data as any).tips)) {
    const allowed = context.allowedCategoryIds ? new Set(context.allowedCategoryIds) : null;
    if (allowed) {
      for (const tipItem of (data as any).tips) {
        if (!allowed.has(tipItem.categoryId)) {
          return {
            valid: false,
            error: `Invalid categoryId "${tipItem.categoryId}". Must be one of: ${Array.from(allowed).join(', ')}`,
          };
        }
      }
    }
  }

  // 5. Numeric Guard
  // Every number token in prose output must appear in the allowed set extracted from context
  const allowedNumbers = extractAllowedNumbers(context);
  const numberTokenRegex =
    /(?:₹|Rs\.?|INR)?\s*\b\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:lakh|crore|cr|lac|k))?\b/gi;
  const matches = combinedProse.match(numberTokenRegex) || [];

  for (const match of matches) {
    const parsed = parseNumberValue(match);
    if (parsed !== null && !allowedNumbers.has(parsed)) {
      return {
        valid: false,
        error: `Numeric guard violation: prose contains unverified number "${match.trim()}" (${parsed}), which does not appear in profile counts or engine-computed facts. The model is forbidden from inventing money or counts.`,
      };
    }
  }

  // 6. Semantic Dietary Validation (for menu suggestions)
  if (
    data &&
    typeof data === 'object' &&
    'suggestions' in data &&
    Array.isArray((data as any).suggestions)
  ) {
    const suggestions = (data as any).suggestions as Array<{ course: string; items: string[] }>;
    const profile = context.profile;

    if (profile) {
      const isPureVegEvent = profile.dietary.nonVeg === 0;
      const hasJainGuests = profile.dietary.jain > 0;
      const isPureJainEvent =
        profile.dietary.jain === profile.guestCount ||
        (profile.dietary.nonVeg === 0 && profile.dietary.veg === 0 && profile.dietary.jain > 0);

      const nonVegRegex = new RegExp(`\\b(${NON_VEG_KEYWORDS.join('|')})\\b`, 'i');
      const jainRootRegex = new RegExp(`\\b(${JAIN_PROHIBITED_ROOT_KEYWORDS.join('|')})\\b`, 'i');

      for (const courseObj of suggestions) {
        const courseName = courseObj.course || '';
        const isJainCourse = /jain/i.test(courseName);

        // Check course name itself for non-veg violation if event is pure veg
        if (isPureVegEvent) {
          const courseNonVegMatch = courseName.match(nonVegRegex);
          if (courseNonVegMatch) {
            return {
              valid: false,
              error: `Dietary violation: profile specifies 0 non-vegetarian guests, but menu course contains meat/fish/egg term "${courseNonVegMatch[0]}" in "${courseName}"`,
            };
          }
        }

        for (const item of courseObj.items || []) {
          // If nonVeg === 0, NO item can contain meat/fish/egg
          if (isPureVegEvent) {
            const nonVegMatch = item.match(nonVegRegex);
            if (nonVegMatch) {
              return {
                valid: false,
                error: `Dietary violation: profile specifies 0 non-vegetarian guests, but menu contains meat/fish/egg term "${nonVegMatch[0]}" in "${item}"`,
              };
            }
          }

          // If Jain guests exist, items labeled for Jain or in Jain courses (or pure Jain events) cannot contain root vegetables
          if (hasJainGuests) {
            const isJainItem = isPureJainEvent || isJainCourse || /jain/i.test(item);
            if (isJainItem) {
              const rootMatch = item.match(jainRootRegex);
              if (rootMatch) {
                return {
                  valid: false,
                  error: `Dietary violation: Jain item contains prohibited root vegetable "${rootMatch[0]}" in "${item}"`,
                };
              }
            }
          }
        }
      }
    }
  }

  return {
    valid: true,
    data,
  };
}
