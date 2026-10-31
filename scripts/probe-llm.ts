/**
 * scripts/probe-llm.ts
 *
 * Live probe benchmark suite for LLM providers (Jarvis / Gemini).
 * Reads .env.local if present.
 * NEVER prints API keys or credentials.
 * If keys are missing, exits cleanly with "not run: no keys".
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { JarvisProvider } from '../src/server/ai/jarvis';
import {
  IdeasSectionSchema,
  MenuSectionSchema,
  CategoryTipsSectionSchema,
  NarrateDiffSectionSchema,
  ChatIntentSectionSchema,
} from '../src/server/ai/sections';
import {
  buildIdeasPrompt,
  buildMenuPrompt,
  buildCategoryTipsPrompt,
  buildNarrateDiffPrompt,
  buildChatIntentPrompt,
  buildRepairPrompt,
} from '../src/server/ai/prompts';
import { extractJsonObject } from '../src/server/ai/jsonExtract';
import { validateOutput } from '../src/server/ai/validators';
import { parseGemini429Details } from '../src/server/ai/gemini';
import {
  weddingPuneFixture,
  birthdayKidsIndoreFixture,
  communityGaneshMumbaiFixture,
} from '../src/domain/fixtures/profiles';
import { PlanDiff } from '../src/domain/rules/replan';

// Load .env.local manually if present
function loadEnvLocal(): Record<string, string> {
  const envPath = resolve(process.cwd(), '.env.local');
  const vars: Record<string, string> = {};

  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed
          .slice(idx + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        vars[key] = val;
      }
    }
  }

  return vars;
}

const localEnv = loadEnvLocal();

const JARVIS_API_KEY = process.env.JARVISLABS_API_KEY || localEnv.JARVISLABS_API_KEY;
const JARVIS_BASE_URL =
  process.env.JARVIS_BASE_URL || localEnv.JARVIS_BASE_URL || 'https://models.jarvislabs.net/v1';
const JARVIS_MODEL = process.env.JARVIS_MODEL || localEnv.JARVIS_MODEL || 'gemma-4-31b-it';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || localEnv.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || localEnv.GEMINI_MODEL || '';
const GROUNDING_ENABLED = (process.env.GROUNDING_ENABLED || localEnv.GROUNDING_ENABLED) === 'true';

const RUN_GEMINI_PROBE = process.argv.includes('--with-gemini');

interface BenchmarkMetric {
  section: string;
  config: string;
  totalRuns: number;
  firstAttemptValid: number;
  totalValid: number;
  latencies: number[];
  finishReasons: Record<string, number>;
  repairs: number;
  truncations: number;
}

function computeStats(latencies: number[]) {
  if (latencies.length === 0) return { avg: 0, p50: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  return { avg, p50, max };
}

function formatRow(m: BenchmarkMetric): string {
  const { avg, p50, max } = computeStats(m.latencies);
  const firstValidPct = `${Math.round((m.firstAttemptValid / m.totalRuns) * 100)}%`;
  const finishSummary = Object.entries(m.finishReasons)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
  return (
    `| ${m.section.padEnd(28)} | ${m.config.padEnd(16)} | ${firstValidPct.padEnd(15)} | ` +
    `${`${avg}ms`.padEnd(9)} | ${`${p50}ms`.padEnd(9)} | ${`${max}ms`.padEnd(9)} | ` +
    `${String(m.repairs).padEnd(7)} | ${finishSummary.padEnd(12)} |`
  );
}

async function runSectionSuite(
  provider: JarvisProvider,
  configLabel: string,
  label: string,
  schema: unknown,
  promptBuilder: () => { system: string; user: string },
  validationContext: unknown,
  runs: number
): Promise<BenchmarkMetric> {
  const metric: BenchmarkMetric = {
    section: label,
    config: configLabel,
    totalRuns: runs,
    firstAttemptValid: 0,
    totalValid: 0,
    latencies: [],
    finishReasons: {},
    repairs: 0,
    truncations: 0,
  };

  for (let run = 1; run <= runs; run++) {
    const t0 = Date.now();
    const prompt = promptBuilder();
    try {
      const res = await provider.generateJson({
        system: prompt.system,
        user: prompt.user,
        schemaName: 'probe_bench',
        maxTokens: 2500,
        temperature: 0.3,
        timeoutMs: 25000,
      });
      const lat = Date.now() - t0;
      metric.latencies.push(lat);

      const finish = res.finishReason || 'stop';
      metric.finishReasons[finish] = (metric.finishReasons[finish] || 0) + 1;
      if (finish === 'length') {
        metric.truncations++;
        continue;
      }

      let parsed: unknown = null;
      let parseErr: string | null = null;
      try {
        parsed = extractJsonObject(res.text);
      } catch (e) {
        parseErr = (e as Error).message;
      }

      if (parsed) {
        const val = validateOutput(
          parsed,
          schema as import('zod').ZodTypeAny,
          validationContext as import('../src/server/ai/validators').ValidationContext
        );
        if (val.valid) {
          metric.firstAttemptValid++;
          metric.totalValid++;
          continue;
        }
        parseErr = val.error || 'validation error';
      }

      // First attempt failed -> trigger 1 repair attempt
      metric.repairs++;
      const repairPrompt = buildRepairPrompt(prompt.user, res.text, parseErr || 'invalid output');
      const repairRes = await provider.generateJson({
        system: prompt.system,
        user: repairPrompt,
        schemaName: 'probe_repair',
        maxTokens: 2500,
        temperature: 0.2,
        timeoutMs: 20000,
      });
      const repairParsed = extractJsonObject(repairRes.text);
      const repairVal = validateOutput(
        repairParsed,
        schema as import('zod').ZodTypeAny,
        validationContext as import('../src/server/ai/validators').ValidationContext
      );
      if (repairVal.valid) {
        metric.totalValid++;
      }
    } catch {
      // provider error, timeout, etc.
    }
  }

  return metric;
}

async function runChatSuite(
  provider: JarvisProvider,
  configLabel: string,
  runsPerMessage: number
): Promise<BenchmarkMetric> {
  const chatMessages = [
    // 5 patch-yielding messages
    { label: 'Chat: Add 50k Catering', msg: 'Increase total catering budget by 50000' },
    { label: 'Chat: Guests to 250', msg: 'Change guest count to 250' },
    { label: 'Chat: Shift 1L Decor', msg: 'Shift 1 lakh from decor to photography' },
    { label: 'Chat: Event Date', msg: 'Change event date to 2027-02-15' },
    {
      label: 'Chat: Dietary Split',
      msg: 'Update vegetarian guests to 180 and non-vegetarian to 20',
    },
    // 5 advice / cultural questions
    { label: 'Chat: Question Attire', msg: 'What should guests wear for an evening Sangeet?' },
    {
      label: 'Chat: Question Favors',
      msg: 'What are traditional Maharashtrian wedding favors in Pune?',
    },
    {
      label: 'Chat: Question Sweets',
      msg: 'Which traditional sweets are customary for a Maharashtrian wedding?',
    },
    {
      label: 'Chat: Question Shehnai',
      msg: 'What acoustic setup is recommended for a live Shehnai performance?',
    },
    {
      label: 'Chat: Question Mandap',
      msg: 'Which flowers are traditionally auspicious for the wedding mandap?',
    },
  ];

  const totalCalls = chatMessages.length * runsPerMessage;
  const metric: BenchmarkMetric = {
    section: `Chat Intent (${chatMessages.length} msgs x ${runsPerMessage})`,
    config: configLabel,
    totalRuns: totalCalls,
    firstAttemptValid: 0,
    totalValid: 0,
    latencies: [],
    finishReasons: {},
    repairs: 0,
    truncations: 0,
  };

  for (const item of chatMessages) {
    for (let run = 1; run <= runsPerMessage; run++) {
      const t0 = Date.now();
      const prompt = buildChatIntentPrompt(weddingPuneFixture, item.msg);
      try {
        const res = await provider.generateJson({
          system: prompt.system,
          user: prompt.user,
          schemaName: 'chat_intent',
          maxTokens: 2500,
          temperature: 0.2,
          timeoutMs: 25000,
        });
        const elapsed = Date.now() - t0;
        metric.latencies.push(elapsed);
        const finish = res.finishReason || 'stop';
        metric.finishReasons[finish] = (metric.finishReasons[finish] || 0) + 1;
        if (finish === 'length') {
          metric.truncations++;
          continue;
        }

        let parsed: unknown = null;
        let parseErr: string | null = null;
        try {
          parsed = extractJsonObject(res.text);
        } catch (e) {
          parseErr = (e as Error).message;
        }

        if (parsed) {
          const val = validateOutput(parsed, ChatIntentSectionSchema, {
            profile: weddingPuneFixture,
            userMessage: item.msg,
          });
          if (val.valid) {
            metric.firstAttemptValid++;
            metric.totalValid++;
            continue;
          }
          parseErr = val.error || 'validation error';
        }

        // First attempt failed -> repair attempt
        metric.repairs++;
        const repairPrompt = buildRepairPrompt(prompt.user, res.text, parseErr || 'invalid output');
        const repairRes = await provider.generateJson({
          system: prompt.system,
          user: repairPrompt,
          schemaName: 'chat_repair',
          maxTokens: 2500,
          temperature: 0.2,
          timeoutMs: 20000,
        });
        const repairParsed = extractJsonObject(repairRes.text);
        const repairVal = validateOutput(repairParsed, ChatIntentSectionSchema, {
          profile: weddingPuneFixture,
          userMessage: item.msg,
        });
        if (repairVal.valid) {
          metric.totalValid++;
        }
      } catch {
        // error
      }
    }
  }

  return metric;
}

async function main() {
  console.log('================================================================');
  console.log('   UTSAV PLANNER - UNIFIED LLM PROBE & BENCHMARK SUITE');
  console.log('================================================================\n');

  if (!JARVIS_API_KEY) {
    console.log('SKIPPED: not run: no keys (JARVISLABS_API_KEY is not set)');
    process.exit(0);
  }

  console.log(`Base URL: ${JARVIS_BASE_URL}`);
  console.log(`Model:    ${JARVIS_MODEL}`);
  console.log(`Key:      [Configured, length: ${JARVIS_API_KEY.length}]`);
  console.log(
    'Benchmarking: Default Thinking ({}) vs Thinking Disabled ({ enable_thinking: false })\n'
  );

  const configs = [
    {
      label: 'Default Thinking',
      extraBody: {},
    },
    {
      label: 'Thinking Off',
      extraBody: { chat_template_kwargs: { enable_thinking: false } },
    },
  ];

  const diffFixture: PlanDiff = {
    budgetLines: [],
    cateringEstimateDelta: 0,
    summaryFacts: [
      'Total budget updated to ₹45,00,000 (+₹5,00,000)',
      'Guest count adjusted from 200 to 250 (+50)',
    ],
    totalDelta: 500000,
    flagsAdded: [],
    flagsRemoved: [],
    milestonesShifted: [],
    checklistAdded: [],
    checklistRemoved: [],
  };

  const allowedCats = ['venue', 'catering', 'decor', 'photo_video'];

  const results: BenchmarkMetric[] = [];

  for (const cfg of configs) {
    console.log(`\n>>> EXECUTING BENCHMARK: [${cfg.label}] ...`);
    const provider = new JarvisProvider({
      apiKey: JARVIS_API_KEY,
      baseURL: JARVIS_BASE_URL,
      model: JARVIS_MODEL,
      jsonMode: 'prompt_only',
      extraBody: cfg.extraBody,
      defaultTimeoutMs: 25000,
    });

    // 1. Ideas Pune (5 runs)
    process.stdout.write(`  [${cfg.label}] Ideas - Pune Wedding (5 runs) ... `);
    const mIdeasPune = await runSectionSuite(
      provider,
      cfg.label,
      'Ideas - Pune Wedding',
      IdeasSectionSchema,
      () => buildIdeasPrompt(weddingPuneFixture),
      { profile: weddingPuneFixture },
      5
    );
    console.log(`Done (${computeStats(mIdeasPune.latencies).avg}ms avg)`);
    results.push(mIdeasPune);

    // 2. Ideas Indore (5 runs)
    process.stdout.write(`  [${cfg.label}] Ideas - Kids Indore (5 runs) ... `);
    const mIdeasIndore = await runSectionSuite(
      provider,
      cfg.label,
      'Ideas - Kids Indore',
      IdeasSectionSchema,
      () => buildIdeasPrompt(birthdayKidsIndoreFixture),
      { profile: birthdayKidsIndoreFixture },
      5
    );
    console.log(`Done (${computeStats(mIdeasIndore.latencies).avg}ms avg)`);
    results.push(mIdeasIndore);

    // 3. Ideas Mumbai (5 runs)
    process.stdout.write(`  [${cfg.label}] Ideas - Community Mumbai (5 runs) ... `);
    const mIdeasMumbai = await runSectionSuite(
      provider,
      cfg.label,
      'Ideas - Community Mumbai',
      IdeasSectionSchema,
      () => buildIdeasPrompt(communityGaneshMumbaiFixture),
      { profile: communityGaneshMumbaiFixture },
      5
    );
    console.log(`Done (${computeStats(mIdeasMumbai.latencies).avg}ms avg)`);
    results.push(mIdeasMumbai);

    // 4. Menu Pune (5 runs)
    process.stdout.write(`  [${cfg.label}] Menu - Pune Wedding (5 runs) ... `);
    const mMenu = await runSectionSuite(
      provider,
      cfg.label,
      'Menu - Pune Wedding',
      MenuSectionSchema,
      () => buildMenuPrompt(weddingPuneFixture),
      { profile: weddingPuneFixture },
      5
    );
    console.log(`Done (${computeStats(mMenu.latencies).avg}ms avg)`);
    results.push(mMenu);

    // 5. Category Tips Pune (5 runs)
    process.stdout.write(`  [${cfg.label}] Category Tips - Pune (5 runs) ... `);
    const mTips = await runSectionSuite(
      provider,
      cfg.label,
      'Category Tips - Pune',
      CategoryTipsSectionSchema,
      () => buildCategoryTipsPrompt(weddingPuneFixture, allowedCats),
      { profile: weddingPuneFixture, allowedCategoryIds: allowedCats },
      5
    );
    console.log(`Done (${computeStats(mTips.latencies).avg}ms avg)`);
    results.push(mTips);

    // 6. Narrate Diff (5 runs)
    process.stdout.write(`  [${cfg.label}] Narrate Diff (5 runs) ... `);
    const mDiff = await runSectionSuite(
      provider,
      cfg.label,
      'Narrate Diff',
      NarrateDiffSectionSchema,
      () => buildNarrateDiffPrompt(diffFixture),
      { profile: weddingPuneFixture, diff: diffFixture },
      5
    );
    console.log(`Done (${computeStats(mDiff.latencies).avg}ms avg)`);
    results.push(mDiff);

    // 7. Chat Intent (10 msgs x 5 runs = 50 runs)
    process.stdout.write(`  [${cfg.label}] Chat Intent (10 msgs x 5 runs = 50 runs) ... `);
    const mChat = await runChatSuite(provider, cfg.label, 5);
    console.log(`Done (${computeStats(mChat.latencies).avg}ms avg)`);
    results.push(mChat);
  }

  // PRINT SIDE-BY-SIDE RAW BENCHMARK TABLE
  console.log(
    '\n===================================================================================================================='
  );
  console.log(
    '                        RAW SIDE-BY-SIDE BENCHMARK TABLE (SAME-SESSION LIVE MEASUREMENT)'
  );
  console.log(
    '===================================================================================================================='
  );
  console.log(
    '| Section                      | Config           | 1st-Att Valid % | Avg Lat   | P50 Lat   | Max Lat   | Repairs | Finish (1st) |'
  );
  console.log(
    '|------------------------------|------------------|-----------------|-----------|-----------|-----------|---------|--------------|'
  );
  for (const m of results) {
    console.log(formatRow(m));
  }
  console.log(
    '====================================================================================================================\n'
  );

  // Optional Gemini probe (guarded so quota is never wasted)
  if (RUN_GEMINI_PROBE && GEMINI_API_KEY && GEMINI_MODEL) {
    console.log('\n--- OPTIONAL GEMINI PROBE (--with-gemini passed) ---');
    const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const t0 = Date.now();
    try {
      const res = await genai.models.generateContent({
        model: GEMINI_MODEL,
        contents: 'Reply in 5 words: What is Utsav?',
      });
      console.log(`Gemini Plain Latency: ${Date.now() - t0}ms | Response: "${res.text?.trim()}"`);
    } catch (err: unknown) {
      const details = parseGemini429Details(err as Parameters<typeof parseGemini429Details>[0]);
      console.log(
        `Gemini error details: quotaMetric=${details.quotaMetric}, retryDelay=${details.retryAfterSeconds}s`
      );
    }
  }

  console.log('Benchmark session finished successfully.');
}

main().catch((err) => {
  console.error('Probe failed with unexpected error:', err.message);
  process.exit(1);
});
