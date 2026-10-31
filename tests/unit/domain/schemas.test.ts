import { describe, it, expect } from 'vitest';
import { validateProfile, sanitizeNotes } from '@/domain/schemas/profile';
import { EventProfilePatchSchema } from '@/domain/schemas/patch';

describe('Event Profile Validation (src/domain/schemas/profile.ts)', () => {
  const TODAY = '2026-10-29';

  const validWeddingInput = {
    eventType: 'wedding',
    eventDate: '2027-02-14',
    cityTier: 'tier1',
    cityName: 'Pune',
    guestCount: 300,
    totalBudgetInr: 2_500_000,
    budgetTier: 'mid',
    venueType: 'lawn',
    functionsCount: 3,
    dietary: { veg: 240, nonVeg: 50, jain: 10, vegan: 0 },
    toggles: { venueIncluded: false, includeAttireJewellery: true },
    overrides: {},
    notes: 'Looking forward to an elegant celebration.',
  };

  it('accepts valid wedding input', () => {
    const result = validateProfile(validWeddingInput, TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.guestCount).toBe(300);
      expect(result.data.functionsCount).toBe(3);
      expect(result.data.toggles.includeAttireJewellery).toBe(true);
    }
  });

  it('forces functionsCount to 1 for non-wedding events', () => {
    const birthdayInput = {
      ...validWeddingInput,
      eventType: 'birthday_kids',
      functionsCount: 4, // Should be overridden to 1
    };

    const result = validateProfile(birthdayInput, TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.functionsCount).toBe(1);
    }
  });

  it('forces includeAttireJewellery to false for non-weddings', () => {
    const festivalInput = {
      ...validWeddingInput,
      eventType: 'community_festival',
      toggles: { venueIncluded: false, includeAttireJewellery: true },
    };

    const result = validateProfile(festivalInput, TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.toggles.includeAttireJewellery).toBe(false);
    }
  });

  it('rejects guest count of 0 or over 5000', () => {
    const zeroGuests = validateProfile({ ...validWeddingInput, guestCount: 0 }, TODAY);
    expect(zeroGuests.ok).toBe(false);
    if (!zeroGuests.ok) {
      expect(zeroGuests.errors.some((e) => e.path === 'guestCount')).toBe(true);
    }

    const tooManyGuests = validateProfile({ ...validWeddingInput, guestCount: 5001 }, TODAY);
    expect(tooManyGuests.ok).toBe(false);
    if (!tooManyGuests.ok) {
      expect(tooManyGuests.errors.some((e) => e.path === 'guestCount')).toBe(true);
    }
  });

  it('rejects event date in the past or equal to today', () => {
    const pastDate = validateProfile({ ...validWeddingInput, eventDate: '2026-10-28' }, TODAY);
    expect(pastDate.ok).toBe(false);
    if (!pastDate.ok) {
      expect(pastDate.errors.some((e) => e.path === 'eventDate')).toBe(true);
    }

    const sameDay = validateProfile({ ...validWeddingInput, eventDate: TODAY }, TODAY);
    expect(sameDay.ok).toBe(false);
    if (!sameDay.ok) {
      expect(sameDay.errors.some((e) => e.path === 'eventDate')).toBe(true);
    }
  });

  it('rejects invalid "today" date argument', () => {
    const result = validateProfile(validWeddingInput, 'invalid-date');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'today')).toBe(true);
    }
  });

  it('rejects when dietary sum exceeds guest count', () => {
    const excessDietary = {
      ...validWeddingInput,
      guestCount: 100,
      dietary: { veg: 80, nonVeg: 30, jain: 0, vegan: 0 }, // 110 > 100
    };

    const result = validateProfile(excessDietary, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'dietary')).toBe(true);
    }
  });

  it('rejects budget below ₹10,000 or above ₹50,00,00,000', () => {
    const lowBudget = validateProfile({ ...validWeddingInput, totalBudgetInr: 9_999 }, TODAY);
    expect(lowBudget.ok).toBe(false);

    const highBudget = validateProfile(
      { ...validWeddingInput, totalBudgetInr: 500_000_001 },
      TODAY
    );
    expect(highBudget.ok).toBe(false);
  });

  it('rejects notes exceeding 500 characters', () => {
    const longNotes = 'a'.repeat(501);
    const result = validateProfile({ ...validWeddingInput, notes: longNotes }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'notes')).toBe(true);
    }
  });

  it('strips control characters from notes while preserving clean text', () => {
    const rawNote = 'Hello\x00 World\x1F!\nLine 2\tTabbed.';
    const sanitized = sanitizeNotes(rawNote);
    expect(sanitized).toBe('Hello World!\nLine 2\tTabbed.');
  });

  it('never throws on arbitrary invalid inputs (null, numbers, arrays, objects)', () => {
    expect(() => validateProfile(null, TODAY)).not.toThrow();
    expect(() => validateProfile(undefined, TODAY)).not.toThrow();
    expect(() => validateProfile(12345, TODAY)).not.toThrow();
    expect(() => validateProfile('string', TODAY)).not.toThrow();
    expect(() => validateProfile([], TODAY)).not.toThrow();
    expect(() => validateProfile({}, TODAY)).not.toThrow();
    expect(() => validateProfile({ eventType: 'invalid_type' }, TODAY)).not.toThrow();

    const result = validateProfile({ invalid: true }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  describe('EventProfilePatchSchema (src/domain/schemas/patch.ts)', () => {
    it('accepts valid partial patches', () => {
      expect(EventProfilePatchSchema.safeParse({ guestCount: 250 }).success).toBe(true);
      expect(EventProfilePatchSchema.safeParse({ totalBudgetInr: 4500000 }).success).toBe(true);
      expect(EventProfilePatchSchema.safeParse({ eventDate: '2027-02-15' }).success).toBe(true);
    });

    it('rejects out of bounds and invalid patch fields', () => {
      expect(EventProfilePatchSchema.safeParse({ guestCount: 999999 }).success).toBe(false);
      expect(EventProfilePatchSchema.safeParse({ totalBudgetInr: -50000 }).success).toBe(false);
      expect(EventProfilePatchSchema.safeParse({ eventDate: 'not-a-date' }).success).toBe(false);
      expect(EventProfilePatchSchema.safeParse({ isAdmin: true }).success).toBe(false);
      expect(EventProfilePatchSchema.safeParse({ guestCount: 'two hundred' }).success).toBe(false);
    });
  });
});
