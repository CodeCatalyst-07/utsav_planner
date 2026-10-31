import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateOutput, parseNumberValue, extractAllowedNumbers } from '@/server/ai/validators';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';
import { PlanDiff } from '@/domain/rules/replan';

describe('AI Output & Semantic Validators (src/server/ai/validators.ts)', () => {
  const dummySchema = z.object({
    narration: z.string(),
  });

  const diffFixture: PlanDiff = {
    budgetLines: [],
    cateringEstimateDelta: 0,
    summaryFacts: [
      'Total event budget changed by +₹10,00,000 (from ₹40,00,000 to ₹50,00,000)',
      'Guest count adjusted from 200 to 250 (+50)',
      'Event date moved by 15 days',
    ],
    totalDelta: 1_000_000,
    flagsAdded: [],
    flagsRemoved: [],
    milestonesShifted: [],
    checklistAdded: [],
    checklistRemoved: [],
  };

  it('correctly parses Indian numeric text representations', () => {
    expect(parseNumberValue('₹40,00,000')).toBe(4_000_000);
    expect(parseNumberValue('40 lakh')).toBe(4_000_000);
    expect(parseNumberValue('1.5 crore')).toBe(15_000_000);
    expect(parseNumberValue('250')).toBe(250);
    expect(parseNumberValue('Rs. 50k')).toBe(50_000);
    expect(parseNumberValue('invalid text')).toBeNull();
  });

  it('extracts allowed numbers from profile and diff facts', () => {
    const context = {
      profile: weddingPuneFixture, // 200 guests, 40L budget, 160 veg, 30 nonVeg, 10 jain
      diff: diffFixture, // +10L delta, 50L total, 250 guests, 15 days
    };
    const allowed = extractAllowedNumbers(context);

    expect(allowed.has(200)).toBe(true);
    expect(allowed.has(4_000_000)).toBe(true);
    expect(allowed.has(1_000_000)).toBe(true);
    expect(allowed.has(5_000_000)).toBe(true);
    expect(allowed.has(250)).toBe(true);
    expect(allowed.has(15)).toBe(true);
    expect(allowed.has(160)).toBe(true);
    // Structural numbers 1..6
    expect(allowed.has(1)).toBe(true);
    expect(allowed.has(3)).toBe(true);
    // Invented numbers not present
    expect(allowed.has(999)).toBe(false);
    expect(allowed.has(75_000)).toBe(false);
  });

  it('accepts prose containing only numbers present in context', () => {
    const context = {
      profile: weddingPuneFixture,
      diff: diffFixture,
    };
    const input = {
      narration:
        'Your guest count was updated to 250 with a total event budget of ₹50,00,000 across 2 functions.',
    };

    const res = validateOutput(input, dummySchema, context);
    expect(res.valid).toBe(true);
    expect(res.data).toEqual(input);
  });

  it('rejects prose with invented monetary amounts (numeric guard violation)', () => {
    const context = {
      profile: weddingPuneFixture,
    };
    const input = {
      narration: 'We estimate photography will cost ₹75,000 for your wedding.',
    };

    const res = validateOutput(input, dummySchema, context);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Numeric guard violation');
    expect(res.error).toContain('75,000');
  });

  it('rejects prose with invented guest counts', () => {
    const context = {
      profile: weddingPuneFixture, // 200 guests
    };
    const input = {
      narration: 'We suggest reserving 450 seating chairs for the ceremony.',
    };

    const res = validateOutput(input, dummySchema, context);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Numeric guard violation');
    expect(res.error).toContain('450');
  });

  it('rejects prohibited claim "guaranteed"', () => {
    const input = {
      narration: 'We offer guaranteed best vendors for your reception.',
    };
    const res = validateOutput(input, dummySchema);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('guaranteed');
  });

  it('rejects prohibited claim "best price"', () => {
    const input = {
      narration: 'Get the best price on local banquet halls.',
    };
    const res = validateOutput(input, dummySchema);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('best price');
  });

  it('rejects synthetic phone numbers in prose', () => {
    const input = {
      narration: 'For immediate booking, call the manager at 9876543210 today.',
    };
    const res = validateOutput(input, dummySchema);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('synthetic phone number');
  });

  it('rejects synthetic URLs in prose', () => {
    const input = {
      narration: 'Visit https://fakevendorpackages.com to book your catering.',
    };
    const res = validateOutput(input, dummySchema);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('synthetic URL');
  });

  it('validates semantic category IDs for category_tips schema', () => {
    const tipsSchema = z.object({
      tips: z.array(z.object({ categoryId: z.string(), tip: z.string() })),
    });

    const context = {
      allowedCategoryIds: ['venue', 'catering', 'decor'],
    };

    // Valid categoryId
    const validTips = {
      tips: [{ categoryId: 'venue', tip: 'Book early for peak season.' }],
    };
    expect(validateOutput(validTips, tipsSchema, context).valid).toBe(true);

    // Invalid categoryId
    const invalidTips = {
      tips: [{ categoryId: 'luxury_jets', tip: 'Charter private flight.' }],
    };
    const result = validateOutput(invalidTips, tipsSchema, context);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid categoryId "luxury_jets"');
  });

  it('scans and rejects any secret leakage in output text', () => {
    const secretKey = 'super-secret-api-token-998877';
    const context = {
      configuredSecrets: [secretKey],
    };
    const leakingOutput = {
      narration: `Contact our support using token ${secretKey} for verification.`,
    };

    const res = validateOutput(leakingOutput, dummySchema, context);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Security violation: Output contains configured secret');
  });

  it('returns failure when Zod schema safeParse fails', () => {
    const invalidSchemaData = {
      narration: 12345 as any, // expected string
    };
    const res = validateOutput(invalidSchemaData, dummySchema);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Schema validation failed');
  });

  describe('Semantic Dietary Validation', () => {
    const menuSchema = z.object({
      suggestions: z.array(
        z.object({
          course: z.string(),
          items: z.array(z.string()),
        })
      ),
    });

    it('accepts pure vegetarian menu when nonVeg === 0', () => {
      const pureVegProfile = {
        ...weddingPuneFixture,
        dietary: { veg: 200, nonVeg: 0, jain: 0, vegan: 0 },
      };
      const validMenu = {
        suggestions: [
          { course: 'Starters', items: ['Paneer Tikka Angare', 'Hara Bhara Kebab'] },
          { course: 'Mains', items: ['Dal Makhani', 'Paneer Butter Masala'] },
        ],
      };

      const res = validateOutput(validMenu, menuSchema, { profile: pureVegProfile });
      expect(res.valid).toBe(true);
      expect(res.data).toEqual(validMenu);
    });

    it('rejects menu containing chicken/fish/egg when nonVeg === 0', () => {
      const pureVegProfile = {
        ...weddingPuneFixture,
        dietary: { veg: 200, nonVeg: 0, jain: 0, vegan: 0 },
      };
      const taintedMenu = {
        suggestions: [
          { course: 'Starters', items: ['Paneer Tikka', 'Murgh Malai Tikka'] },
          { course: 'Mains', items: ['Dal Makhani'] },
        ],
      };

      const res = validateOutput(taintedMenu, menuSchema, { profile: pureVegProfile });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Dietary violation');
      expect(res.error).toContain('0 non-vegetarian guests');
      expect(res.error).toContain('Murgh');
    });

    it('rejects course name containing non-veg keyword when nonVeg === 0', () => {
      const pureVegProfile = {
        ...weddingPuneFixture,
        dietary: { veg: 200, nonVeg: 0, jain: 0, vegan: 0 },
      };
      const taintedMenu = {
        suggestions: [{ course: 'Seafood Counter', items: ['Paneer Skewers'] }],
      };

      const res = validateOutput(taintedMenu, menuSchema, { profile: pureVegProfile });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Dietary violation');
      expect(res.error).toContain('Seafood');
    });

    it('accepts non-veg items when nonVeg > 0', () => {
      const mixedProfile = {
        ...weddingPuneFixture,
        dietary: { veg: 150, nonVeg: 50, jain: 0, vegan: 0 },
      };
      const mixedMenu = {
        suggestions: [{ course: 'Starters', items: ['Paneer Tikka', 'Murgh Malai Tikka'] }],
      };

      const res = validateOutput(mixedMenu, menuSchema, { profile: mixedProfile });
      expect(res.valid).toBe(true);
    });

    it('accepts Jain counter with root-free items when jain > 0', () => {
      const jainProfile = {
        ...weddingPuneFixture,
        dietary: { veg: 180, nonVeg: 0, jain: 20, vegan: 0 },
      };
      const validJainMenu = {
        suggestions: [
          { course: 'General Mains', items: ['Paneer Lababdar', 'Dal Makhani'] },
          {
            course: 'Jain Counter',
            items: ['Kela Methi Nu Shaak (Raw Banana)', 'Jain Moong Dal', 'Steamed Rice'],
          },
        ],
      };

      const res = validateOutput(validJainMenu, menuSchema, { profile: jainProfile });
      expect(res.valid).toBe(true);
    });

    it('rejects Jain counter containing potato, onion, or garlic', () => {
      const jainProfile = {
        ...weddingPuneFixture,
        dietary: { veg: 180, nonVeg: 0, jain: 20, vegan: 0 },
      };
      const taintedJainMenu = {
        suggestions: [
          {
            course: 'Jain Counter',
            items: ['Aloo Jeera (Jain)', 'Jain Dal'],
          },
        ],
      };

      const res = validateOutput(taintedJainMenu, menuSchema, { profile: jainProfile });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Dietary violation');
      expect(res.error).toContain('Jain item contains prohibited root vegetable');
      expect(res.error).toContain('Aloo');
    });

    it('rejects any root vegetable for 100% Jain event even without explicit Jain course label', () => {
      const pureJainProfile = {
        ...weddingPuneFixture,
        guestCount: 100,
        dietary: { veg: 0, nonVeg: 0, jain: 100, vegan: 0 },
      };
      const taintedMenu = {
        suggestions: [
          {
            course: 'Dinner Mains',
            items: ['Dum Aloo Kashmiri', 'Paneer Makhani'],
          },
        ],
      };

      const res = validateOutput(taintedMenu, menuSchema, { profile: pureJainProfile });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Dietary violation');
      expect(res.error).toContain('Aloo');
    });
  });
});
