import { describe, it, expect } from 'vitest';
import { DeterministicFallback } from '@/server/ai/fallback';
import { buildSampleProfile } from '@/domain/fixtures/profiles';
import { PlanDiff } from '@/domain/rules/replan';

describe('DeterministicFallback (src/server/ai/fallback.ts)', () => {
  const weddingProfile = buildSampleProfile('wedding', '2026-10-29');

  it('generates valid ideas for wedding and other event types', () => {
    const weddingIdeas = DeterministicFallback.getIdeas(weddingProfile);
    expect(weddingIdeas.themes).toHaveLength(3);
    expect(weddingIdeas.themes[0]!.title.length).toBeGreaterThan(0);
    expect(weddingIdeas.themes[0]!.description.length).toBeGreaterThan(0);

    const festivalProfile = { ...weddingProfile, eventType: 'community_festival' as const };
    const festivalIdeas = DeterministicFallback.getIdeas(festivalProfile);
    expect(festivalIdeas.themes).toHaveLength(3);

    const unknownProfile = { ...weddingProfile, eventType: 'unknown_type' as any };
    const fallbackIdeas = DeterministicFallback.getIdeas(unknownProfile);
    expect(fallbackIdeas.themes).toHaveLength(3);
  });

  it('generates category tips matching allowed categories or falls back to first allowed', () => {
    const tips = DeterministicFallback.getCategoryTips(weddingProfile, ['venue', 'catering']);
    expect(tips.tips.length).toBeGreaterThan(0);
    expect(['venue', 'catering']).toContain(tips.tips[0]!.categoryId);

    // When no predefined tip matches the allowed list
    const unlistedCatTips = DeterministicFallback.getCategoryTips(weddingProfile, [
      'rare_custom_cat',
    ]);
    expect(unlistedCatTips.tips).toHaveLength(1);
    expect(unlistedCatTips.tips[0]!.categoryId).toBe('rare_custom_cat');
    expect(unlistedCatTips.tips[0]!.tip).toContain('contracts carefully');

    // When allowed list is empty
    const emptyAllowedTips = DeterministicFallback.getCategoryTips(weddingProfile, []);
    expect(emptyAllowedTips.tips).toHaveLength(1);
    expect(emptyAllowedTips.tips[0]!.categoryId).toBe('venue');
  });

  it('generates menu suggestions with courses and items', () => {
    const menu = DeterministicFallback.getMenu(weddingProfile);
    expect(menu.suggestions.length).toBeGreaterThan(0);
    expect(menu.suggestions[0]!.course).toBeTruthy();
    expect(menu.suggestions[0]!.items.length).toBeGreaterThan(0);
  });

  it('guarantees dietary compliance in fallback menu for pure veg and Jain profiles', () => {
    const pureVegProfile = {
      ...weddingProfile,
      dietary: { veg: 200, nonVeg: 0, jain: 0, vegan: 0 },
    };
    const vegMenu = DeterministicFallback.getMenu(pureVegProfile);
    const allVegItems = vegMenu.suggestions.flatMap((s) => s.items);
    expect(allVegItems).not.toContain('Amritsari Fish Bites');
    expect(allVegItems).toContain('Dahi Ke Kebab');

    const jainProfile = {
      ...weddingProfile,
      dietary: { veg: 180, nonVeg: 0, jain: 20, vegan: 0 },
    };
    const jainMenu = DeterministicFallback.getMenu(jainProfile);
    const jainCourse = jainMenu.suggestions.find((s) => /Jain/i.test(s.course));
    expect(jainCourse).toBeDefined();
    expect(jainCourse?.items).toContain('Kela Methi Nu Shaak (Raw Banana)');
  });

  it('generates diff narration for empty and non-empty summary facts', () => {
    const emptyDiff: PlanDiff = {
      budgetLines: [],
      totalDelta: 0,
      cateringEstimateDelta: 0,
      milestonesShifted: [],
      checklistAdded: [],
      checklistRemoved: [],
      flagsAdded: [],
      flagsRemoved: [],
      summaryFacts: [],
    };

    const emptyNarration = DeterministicFallback.getNarrateDiff(emptyDiff);
    expect(emptyNarration.narration).toBe('No structural changes were made to your event plan.');

    const normalDiff: PlanDiff = {
      ...emptyDiff,
      summaryFacts: ['Guest count increased by 50', 'Catering budget adjusted'],
    };
    const normalNarration = DeterministicFallback.getNarrateDiff(normalDiff);
    expect(normalNarration.narration).toBe('Guest count increased by 50. Catering budget adjusted');

    // Long diff exceeding 400 chars is truncated
    const longDiff: PlanDiff = {
      ...emptyDiff,
      summaryFacts: ['A'.repeat(150), 'B'.repeat(150), 'C'.repeat(150)],
    };
    const longNarration = DeterministicFallback.getNarrateDiff(longDiff);
    expect(longNarration.narration.length).toBeLessThanOrEqual(400);
    expect(longNarration.narration.endsWith('...')).toBe(true);
  });

  it('generates chat intent with default question reply', () => {
    const chatIntent = DeterministicFallback.getChatIntent();
    expect(chatIntent.intent).toBe('question');
    expect(chatIntent.reply).toContain('celebration');
  });
});
