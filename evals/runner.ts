import 'server-only';
import { EVAL_SCENARIOS } from './scenarios';
import {
  IdeasSectionSchema,
  MenuSectionSchema,
  CategoryTipsSectionSchema,
  NarrateDiffSectionSchema,
  ChatIntentSectionSchema,
} from '../src/server/ai/sections';
import { validateOutput } from '../src/server/ai/validators';
import { DeterministicFallback } from '../src/server/ai/fallback';
import { getConfiguredProviders, getEnv } from '../src/server/env';
import { FailoverChain } from '../src/server/ai/chain';
import {
  buildIdeasPrompt,
  buildMenuPrompt,
  buildCategoryTipsPrompt,
  buildNarrateDiffPrompt,
} from '../src/server/ai/prompts';
import { buildPlan } from '../src/domain/rules/plan';

/**
 * evals/runner.ts
 *
 * Utsav Planner AI Evaluation Harness
 *
 * Runs 12 Indian celebration scenarios across existing event types:
 * - POSITIVE CASES: validates that valid outputs (live or deterministic fallback) pass:
 *     1. Schema validity
 *     2. Numeric guards (no invented rupee amounts or dates)
 *     3. Dietary rules (zero meat/egg/fish in veg events, zero root vegetables in Jain items)
 *     4. Allowed category IDs
 *     5. Zero secret leakage
 *
 * - NEGATIVE CASES: validates that deliberately poisoned outputs are strictly REJECTED:
 *     1. Meat in all-vegetarian menu (nonVeg === 0)
 *     2. Root vegetables in Jain counter (jain > 0)
 *     3. Invented rupee amounts not in profile or diff facts
 *     4. Secret key leakage in generated prose
 *     5. Schema-violating chat patches (negative numbers or budget cap overflows)
 *     6. Invented / unauthorized category IDs
 */

interface EvalResult {
  scenarioId: string;
  name: string;
  passed: boolean;
  checks: Array<{ name: string; ok: boolean; message?: string }>;
}

async function runEvals() {
  console.log('='.repeat(80));
  console.log('  UTSAV PLANNER - AI EVALUATION & RELIABILITY HARNESS');
  console.log('='.repeat(80));

  const providers = getConfiguredProviders();
  const liveMode = Boolean(process.env.RUN_LIVE_EVALS && (providers.jarvis || providers.gemini));
  console.log(
    `Execution Mode: ${liveMode ? 'LIVE LLM PROVIDERS' : 'DETERMINISTIC CI / RECORDED FIXTURES'}`
  );
  console.log(`Configured Providers: Jarvis=${providers.jarvis}, Gemini=${providers.gemini}`);
  console.log(`Total Scenarios: ${EVAL_SCENARIOS.length}\n`);

  const results: EvalResult[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // --------------------------------------------------------------------------
  // PART 1: POSITIVE CASES (12 Scenarios)
  // --------------------------------------------------------------------------
  console.log('--- PART 1: POSITIVE EVALUATIONS (12 Culturally Neutral Scenarios) ---');

  const chain = new FailoverChain();

  for (const scenario of EVAL_SCENARIOS) {
    const checks: Array<{ name: string; ok: boolean; message?: string }> = [];
    const profile = scenario.profile;

    // 1. Ideas Section
    const ideasPrompt = buildIdeasPrompt(profile);
    const ideasResult = liveMode
      ? await chain.executeSection({
          section: 'ideas',
          schema: IdeasSectionSchema,
          promptBuilder: () => ideasPrompt,
          fallbackGetter: () => DeterministicFallback.getIdeas(profile),
          profile,
        })
      : { data: DeterministicFallback.getIdeas(profile), meta: { provider: 'template' } };

    const ideasValidation = validateOutput(ideasResult.data, IdeasSectionSchema, { profile });
    checks.push({
      name: 'Ideas Schema & Numeric Guard',
      ok: ideasValidation.valid,
      message: ideasValidation.error,
    });

    // 2. Menu Section & Dietary Respect
    const menuPrompt = buildMenuPrompt(profile);
    const menuResult = liveMode
      ? await chain.executeSection({
          section: 'menu',
          schema: MenuSectionSchema,
          promptBuilder: () => menuPrompt,
          fallbackGetter: () => DeterministicFallback.getMenu(profile),
          profile,
        })
      : { data: DeterministicFallback.getMenu(profile), meta: { provider: 'template' } };

    const menuValidation = validateOutput(menuResult.data, MenuSectionSchema, { profile });
    checks.push({
      name: 'Menu Dietary Respect & Variety',
      ok: menuValidation.valid,
      message: menuValidation.error,
    });

    // 3. Category Tips
    const tipsPrompt = buildCategoryTipsPrompt(profile, scenario.expectedCategoryIds);
    const tipsResult = liveMode
      ? await chain.executeSection({
          section: 'category_tips',
          schema: CategoryTipsSectionSchema,
          promptBuilder: () => tipsPrompt,
          fallbackGetter: () =>
            DeterministicFallback.getCategoryTips(profile, scenario.expectedCategoryIds),
          profile,
        })
      : {
          data: DeterministicFallback.getCategoryTips(profile, scenario.expectedCategoryIds),
          meta: { provider: 'template' },
        };

    const tipsValidation = validateOutput(tipsResult.data, CategoryTipsSectionSchema, {
      profile,
      allowedCategoryIds: scenario.expectedCategoryIds,
    });
    checks.push({
      name: 'Category Tips Allowed IDs Guard',
      ok: tipsValidation.valid,
      message: tipsValidation.error,
    });

    // 4. Narrate Diff
    const sampleDiff = {
      summaryFacts: [`Increased guest count to ${profile.guestCount}`, 'Adjusted catering budget'],
      totalDelta: 0,
    };
    const diffPrompt = buildNarrateDiffPrompt(sampleDiff as any);
    const diffResult = liveMode
      ? await chain.executeSection({
          section: 'narrate_diff',
          schema: NarrateDiffSectionSchema,
          promptBuilder: () => diffPrompt,
          fallbackGetter: () => DeterministicFallback.getNarrateDiff(sampleDiff as any),
          profile,
          diff: sampleDiff as any,
        })
      : {
          data: DeterministicFallback.getNarrateDiff(sampleDiff as any),
          meta: { provider: 'template' },
        };

    const diffValidation = validateOutput(diffResult.data, NarrateDiffSectionSchema, {
      profile,
      diff: sampleDiff as any,
    });
    checks.push({
      name: 'Narrate Diff Guard (Zero Invented Money)',
      ok: diffValidation.valid,
      message: diffValidation.error,
    });

    const scenarioPassed = checks.every((c) => c.ok);
    results.push({
      scenarioId: scenario.id,
      name: scenario.name,
      passed: scenarioPassed,
      checks,
    });

    checks.forEach((c) => {
      totalChecks++;
      if (c.ok) passedChecks++;
    });

    const statusIcon = scenarioPassed ? '✓' : '✗';
    console.log(
      ` ${statusIcon} [${scenario.id}] ${scenario.name} (${checks.filter((c) => c.ok).length}/${checks.length} passed)`
    );
    if (!scenarioPassed) {
      checks
        .filter((c) => !c.ok)
        .forEach((c) => console.log(`     FAILED: ${c.name} -> ${c.message}`));
    }
  }

  // --------------------------------------------------------------------------
  // PART 2: NEGATIVE EVALUATIONS (Deliberately Poisoned Fixtures)
  // --------------------------------------------------------------------------
  console.log(
    '\n--- PART 2: NEGATIVE EVALUATIONS (Deliberately Poisoned Adversarial Fixtures) ---'
  );

  const negativeChecks: Array<{ name: string; ok: boolean; rejectionReason?: string }> = [];

  const pureVegProfile = EVAL_SCENARIOS[0]!.profile; // Pune Wedding (nonVeg: 0, jain: 20)
  const jainProfile = EVAL_SCENARIOS[7]!.profile; // Ahmedabad Milestone (jain: 60)

  // Poison 1: Meat injected into pure vegetarian event
  const poisonedMeatMenu = {
    suggestions: [
      { course: 'Starters', items: ['Paneer Tikka', 'Chicken Tikka Crispy'] },
      { course: 'Mains', items: ['Dal Makhani', 'Jeera Rice'] },
    ],
  };
  const poison1Result = validateOutput(poisonedMeatMenu, MenuSectionSchema, {
    profile: pureVegProfile,
  });
  const poison1Blocked = !poison1Result.valid && poison1Result.error?.includes('Dietary violation');
  negativeChecks.push({
    name: 'Poison 1: Meat in Pure-Veg Menu Rejected by Semantic Validator',
    ok: Boolean(poison1Blocked),
    rejectionReason: poison1Result.error,
  });

  // Poison 2: Root vegetables injected into Jain counter
  const poisonedJainMenu = {
    suggestions: [
      {
        course: 'Dedicated Jain Counter',
        items: ['Jain Paneer Curry', 'Aloo Masala Fry with Garlic Naan'],
      },
    ],
  };
  const poison2Result = validateOutput(poisonedJainMenu, MenuSectionSchema, {
    profile: jainProfile,
  });
  const poison2Blocked =
    !poison2Result.valid &&
    (poison2Result.error?.includes('prohibited root vegetable') ||
      poison2Result.error?.includes('Dietary violation'));
  negativeChecks.push({
    name: 'Poison 2: Root Vegetables in Jain Counter Rejected by Validator',
    ok: Boolean(poison2Blocked),
    rejectionReason: poison2Result.error,
  });

  // Poison 3: Invented Rupee Amounts in Diff Prose (Numeric Guard violation)
  const poisonedNumericDiff = {
    narration:
      'We adjusted your celebration plan! You saved ₹9,99,999 on catering and your new total is ₹88,88,888.',
  };
  const poison3Result = validateOutput(poisonedNumericDiff, NarrateDiffSectionSchema, {
    profile: pureVegProfile,
    diff: { summaryFacts: ['Saved ₹50,000'], totalDelta: -50000 } as any,
  });
  const poison3Blocked =
    !poison3Result.valid && poison3Result.error?.includes('Numeric guard violation');
  negativeChecks.push({
    name: 'Poison 3: Hallucinated Rupee Amount Rejected by Numeric Guard',
    ok: Boolean(poison3Blocked),
    rejectionReason: poison3Result.error,
  });

  // Poison 4: Secret Key Leakage in Generated Prose
  const poisonedSecretIdeas = {
    themes: [
      {
        title: 'Secret Mandap',
        description:
          'Exclusive celebration powered by key jarvislabs_live_secret_key_99999 and luxury floral drapes.',
      },
      {
        title: 'Botanical Courtyard',
        description: 'Pastel floral canopies and fresh acoustic melodies for daytime gatherings.',
      },
      {
        title: 'Festive Vibrant Mela',
        description: 'Artisanal regional folk stalls and energetic musical celebrations.',
      },
    ],
  };
  const poison4Result = validateOutput(poisonedSecretIdeas, IdeasSectionSchema, {
    profile: pureVegProfile,
    configuredSecrets: ['jarvislabs_live_secret_key_99999'],
  });
  const poison4Blocked =
    !poison4Result.valid &&
    (poison4Result.error?.toLowerCase().includes('secret') ||
      poison4Result.error?.includes('Security violation'));
  negativeChecks.push({
    name: 'Poison 4: API Key Leakage in Output Rejected by Security Scanner',
    ok: Boolean(poison4Blocked),
    rejectionReason: poison4Result.error,
  });

  // Poison 5: Chat Patch Schema & Budget Bounds Violation
  const poisonedChatPatch = {
    intentType: 'modify_budget',
    actionSummary: 'Overflow budget',
    confidence: 'high',
    patch: {
      totalBudgetInr: 999_000_000_000, // Exceeds ₹50 Cr upper bound
      guestCount: -50, // Negative guest count
    },
  };
  const poison5Result = ChatIntentSectionSchema.safeParse(poisonedChatPatch);
  const poison5Blocked = !poison5Result.success;
  negativeChecks.push({
    name: 'Poison 5: Adversarial Negative / Out-of-Bounds Chat Patch Rejected',
    ok: poison5Blocked,
    rejectionReason: poison5Result.error?.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; '),
  });

  // Poison 6: Invented / Unauthorized Category ID
  const poisonedCategoryTips = {
    tips: [
      { categoryId: 'luxury_private_jets', tip: 'Book private chartered flights for all guests.' },
    ],
  };
  const poison6Result = validateOutput(poisonedCategoryTips, CategoryTipsSectionSchema, {
    profile: pureVegProfile,
    allowedCategoryIds: ['venue', 'catering', 'decor'],
  });
  const poison6Blocked =
    !poison6Result.valid && poison6Result.error?.toLowerCase().includes('category');
  negativeChecks.push({
    name: 'Poison 6: Hallucinated Category ID Rejected by Domain Validator',
    ok: Boolean(poison6Blocked),
    rejectionReason: poison6Result.error,
  });

  for (const nc of negativeChecks) {
    totalChecks++;
    if (nc.ok) passedChecks++;
    const icon = nc.ok ? '✓' : '✗';
    console.log(` ${icon} [ADVERSARIAL] ${nc.name}`);
    if (nc.rejectionReason) {
      console.log(`     Correctly caught with: ${nc.rejectionReason.slice(0, 110)}...`);
    }
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log(
    `  EVAL SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED (Score: ${Math.round((passedChecks / totalChecks) * 100)}%)`
  );
  console.log('='.repeat(80));

  if (passedChecks !== totalChecks) {
    process.exit(1);
  }
}

runEvals().catch((err) => {
  console.error('Fatal error in eval runner:', err);
  process.exit(1);
});
