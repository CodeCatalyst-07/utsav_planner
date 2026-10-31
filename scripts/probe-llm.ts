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
import OpenAI from 'openai';
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

interface ProbeMetric {
  section: string;
  totalRuns: number;
  validCount: number;
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

function formatRow(label: string, metric: ProbeMetric): string {
  const { avg, p50, max } = computeStats(metric.latencies);
  const validPct = Math.round((metric.validCount / Math.max(1, metric.totalRuns)) * 100);
  const finishSummary =
    Object.entries(metric.finishReasons)
      .map(([k, v]) => `${k}:${v}`)
      .join(',') || 'none';
  return `| ${label.padEnd(28)} | ${(validPct + '%').padEnd(7)} | ${(avg + 'ms').padEnd(8)} | ${(p50 + 'ms').padEnd(8)} | ${(max + 'ms').padEnd(8)} | ${finishSummary.padEnd(16)} | ${String(metric.repairs).padEnd(7)} | ${String(metric.truncations).padEnd(11)} |`;
}

async function main() {
  console.log('================================================================');
  console.log('   UTSAV PLANNER - LLM LIVE PROBE BENCHMARK SUITE (PHASE 2.4)');
  console.log('================================================================');

  if (!JARVIS_API_KEY && !GEMINI_API_KEY) {
    console.log('not run: no keys');
    console.log(
      'Neither JARVISLABS_API_KEY nor GEMINI_API_KEY configured in environment or .env.local.'
    );
    process.exit(0);
  }

  // --- 1. JARVIS PLAIN CHAT LATENCY & REASONING TOKENS ---
  if (JARVIS_API_KEY) {
    console.log('\n--- 1. JARVIS PLAIN CHAT LATENCY & REASONING TOKENS ---');
    const client = new OpenAI({ apiKey: JARVIS_API_KEY, baseURL: JARVIS_BASE_URL });
    const t0 = Date.now();
    try {
      const res = await client.chat.completions.create({
        model: JARVIS_MODEL,
        messages: [{ role: 'user', content: 'Reply in 5 words: What is Diwali?' }],
        max_tokens: 1024,
      });
      const latency = Date.now() - t0;
      const choice = res.choices[0];
      const message = choice?.message as any;
      const content = message?.content?.trim() || '';
      const reasoningContent = message?.reasoning_content?.trim() || '';
      const finishReason = choice?.finish_reason;
      const usage = res.usage;

      console.log(`Latency: ${latency}ms`);
      console.log(`Finish Reason: ${finishReason}`);
      console.log(
        `Usage: prompt_tokens=${usage?.prompt_tokens}, completion_tokens=${usage?.completion_tokens}, total_tokens=${usage?.total_tokens}`
      );
      console.log(`Message Content: "${content.slice(0, 100)}"`);
      console.log(
        `Reasoning Content: ${reasoningContent ? `"${reasoningContent.slice(0, 100)}..." (${reasoningContent.length} chars)` : 'None (model did not emit separate reasoning_content)'}`
      );
    } catch (err) {
      console.log(`Jarvis plain chat error: ${(err as Error).message}`);
    }

    // --- 2. JARVIS JSON: prompt_only VS response_format ---
    console.log('\n--- 2. JARVIS JSON: prompt_only VS response_format (WHITESPACE TRAP) ---');
    for (const mode of ['prompt_only', 'response_format'] as const) {
      const tStart = Date.now();
      try {
        const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
          model: JARVIS_MODEL,
          messages: [
            {
              role: 'system',
              content:
                mode === 'prompt_only'
                  ? 'Output strictly a JSON object: {"festival": string, "month": string}. No other text.'
                  : 'You are a helpful assistant.',
            },
            { role: 'user', content: 'Return Diwali festival information.' },
          ],
          max_tokens: 1024,
          temperature: 0.2,
          ...(mode === 'response_format' ? { response_format: { type: 'json_object' } } : {}),
        };
        const res = await client.chat.completions.create(body);
        const lat = Date.now() - tStart;
        const raw = res.choices[0]?.message?.content || '';
        const finishReason = res.choices[0]?.finish_reason;
        const isWhitespaceOnly = raw.trim().length === 0;
        console.log(
          `Mode: [${mode.padEnd(15)}] | Latency: ${lat}ms | Finish: ${finishReason} | Whitespace-only trap: ${isWhitespaceOnly ? 'YES (TRAP)' : 'NO (SAFE)'}`
        );
      } catch (err) {
        console.log(`Mode: [${mode}] error: ${(err as Error).message}`);
      }
    }

    // --- 3. REASONING TOGGLE EXPERIMENTS (3 RUNS EACH) ---
    console.log('\n--- 3. REASONING TOGGLE EXPERIMENTS (3 RUNS EACH) ---');
    const toggleVariants = [
      { name: 'none (default)', extra: {} },
      {
        name: 'enable_thinking: false',
        extra: { chat_template_kwargs: { enable_thinking: false } },
      },
      { name: 'reasoning: effort=low', extra: { reasoning: { effort: 'low' } } },
      { name: 'reasoning_effort: low', extra: { reasoning_effort: 'low' } },
    ];

    for (const variant of toggleVariants) {
      console.log(`\nEvaluating variant: [${variant.name}]`);
      const latencies: number[] = [];
      const tokenCounts: number[] = [];
      let rejected = false;

      for (let run = 1; run <= 3; run++) {
        const tStart = Date.now();
        try {
          const body: any = {
            model: JARVIS_MODEL,
            messages: [
              {
                role: 'user',
                content: 'Suggest 2 wedding colors in JSON: {"colors": string[]}',
              },
            ],
            max_tokens: 1024,
            temperature: 0.2,
            ...variant.extra,
          };
          const res = await client.chat.completions.create(body);
          const lat = Date.now() - tStart;
          latencies.push(lat);
          const totalTokens = res.usage?.total_tokens ?? 0;
          tokenCounts.push(totalTokens);
          const choice = res.choices[0];
          const hasReasoning = Boolean((choice?.message as any)?.reasoning_content);
          console.log(
            `  Run ${run}: Latency=${lat}ms | TotalTokens=${totalTokens} | HasReasoningField=${hasReasoning} | Finish=${choice?.finish_reason}`
          );
        } catch (err) {
          rejected = true;
          console.log(`  Run ${run} rejected: ${(err as Error).message}`);
        }
      }

      if (!rejected && latencies.length > 0) {
        const avgLat = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
        const avgTok = Math.round(tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length);
        console.log(`  Summary [${variant.name}]: Avg Latency=${avgLat}ms, Avg Tokens=${avgTok}`);
      }
    }

    // --- 4. RECONCILIATION: OLD CONFIGURATION VS NEW PIPELINE ---
    console.log('\n================================================================');
    console.log('--- 4A. OLD PROBE CONFIGURATION (max_tokens: 400, naive regex) ---');
    console.log('================================================================');

    const oldSamples = [
      {
        name: 'Ideas - Pune Wedding',
        prompt: '3 wedding themes: JSON {"themes":[{"title":string,"description":string}]}',
      },
      {
        name: 'Ideas - Kids Indore',
        prompt: '3 kids party themes: JSON {"themes":[{"title":string,"description":string}]}',
      },
      {
        name: 'Ideas - Community Mumbai',
        prompt: '3 festival themes: JSON {"themes":[{"title":string,"description":string}]}',
      },
    ];

    const oldResults: Record<string, ProbeMetric> = {};

    for (const sample of oldSamples) {
      const metric: ProbeMetric = {
        section: sample.name,
        totalRuns: 5,
        validCount: 0,
        latencies: [],
        finishReasons: {},
        repairs: 0,
        truncations: 0,
      };

      for (let run = 1; run <= 5; run++) {
        const tRun = Date.now();
        try {
          const res = await client.chat.completions.create({
            model: JARVIS_MODEL,
            messages: [
              {
                role: 'system',
                content:
                  'You are a JSON assistant. Return ONLY valid JSON matching {"themes":[{"title":string,"description":string}]}.',
              },
              { role: 'user', content: sample.prompt },
            ],
            max_tokens: 400, // Old starved budget
            temperature: 0.3,
          });
          const lat = Date.now() - tRun;
          metric.latencies.push(lat);

          const choice = res.choices[0];
          const finish = choice?.finish_reason || 'unknown';
          metric.finishReasons[finish] = (metric.finishReasons[finish] || 0) + 1;
          if (finish === 'length') {
            metric.truncations++;
          }

          const raw = choice?.message?.content || '';
          // Old naive parser
          const cleaned = raw.replace(/```(?:json)?|```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed?.themes) && parsed.themes.length > 0) {
            metric.validCount++;
          }
        } catch {
          // parse error, truncation, or network failure
        }
      }
      oldResults[sample.name] = metric;
    }

    console.log('\nOLD PROBE RESULTS TABLE:');
    console.log(
      '| Section                      | Valid % | Avg Lat  | P50 Lat  | Max Lat  | Finish Reasons   | Repairs | Truncations |'
    );
    console.log(
      '|------------------------------|---------|----------|----------|----------|------------------|---------|-------------|'
    );
    for (const [name, m] of Object.entries(oldResults)) {
      console.log(formatRow(name, m));
    }

    console.log('\n================================================================');
    console.log('--- 4B. NEW PRODUCTION PIPELINE (Jarvis only, max_tokens: 2500) ---');
    console.log('================================================================');

    const jarvisProvider = new JarvisProvider({
      apiKey: JARVIS_API_KEY,
      baseURL: JARVIS_BASE_URL,
      model: JARVIS_MODEL,
      jsonMode: 'prompt_only',
      defaultTimeoutMs: 25000,
    });

    const newResults: Record<string, ProbeMetric> = {};

    async function runNewPipelineSection(
      label: string,
      schema: any,
      promptBuilder: () => { system: string; user: string },
      validationContext: any,
      runs: number
    ): Promise<ProbeMetric> {
      const metric: ProbeMetric = {
        section: label,
        totalRuns: runs,
        validCount: 0,
        latencies: [],
        finishReasons: {},
        repairs: 0,
        truncations: 0,
      };

      for (let run = 1; run <= runs; run++) {
        const t0 = Date.now();
        const prompt = promptBuilder();
        try {
          const res = await jarvisProvider.generateJson({
            system: prompt.system,
            user: prompt.user,
            schemaName: 'probe_test',
            maxTokens: 2500, // Production budget
            temperature: 0.3,
            timeoutMs: 20000,
          });
          const lat = Date.now() - t0;
          metric.latencies.push(lat);

          const finish = res.finishReason || 'stop';
          metric.finishReasons[finish] = (metric.finishReasons[finish] || 0) + 1;
          if (finish === 'length') {
            metric.truncations++;
            continue;
          }

          let parsed: any = null;
          let parseErr: string | null = null;
          try {
            parsed = extractJsonObject(res.text);
          } catch (e) {
            parseErr = (e as Error).message;
          }

          if (parsed) {
            const val = validateOutput(parsed, schema, validationContext);
            if (val.valid) {
              metric.validCount++;
              continue;
            }
            parseErr = val.error || 'validation error';
          }

          // 1 repair attempt
          metric.repairs++;
          const repairPrompt = buildRepairPrompt(
            prompt.user,
            res.text,
            parseErr || 'invalid output'
          );
          const repairRes = await jarvisProvider.generateJson({
            system: prompt.system,
            user: repairPrompt,
            schemaName: 'probe_repair',
            maxTokens: 2500,
            temperature: 0.2,
            timeoutMs: 15000,
          });
          const repairParsed = extractJsonObject(repairRes.text);
          const repairVal = validateOutput(repairParsed, schema, validationContext);
          if (repairVal.valid) {
            metric.validCount++;
          }
        } catch {
          // failure
        }
      }

      return metric;
    }

    // 1. ideas x 5 for each of 3 profiles
    console.log('Testing Section: ideas x 5 for each of 3 profiles ...');
    newResults['Ideas - Pune Wedding'] = await runNewPipelineSection(
      'Ideas - Pune Wedding',
      IdeasSectionSchema,
      () => buildIdeasPrompt(weddingPuneFixture),
      { profile: weddingPuneFixture },
      5
    );

    newResults['Ideas - Kids Indore'] = await runNewPipelineSection(
      'Ideas - Kids Indore',
      IdeasSectionSchema,
      () => buildIdeasPrompt(birthdayKidsIndoreFixture),
      { profile: birthdayKidsIndoreFixture },
      5
    );

    newResults['Ideas - Community Mumbai'] = await runNewPipelineSection(
      'Ideas - Community Mumbai',
      IdeasSectionSchema,
      () => buildIdeasPrompt(communityGaneshMumbaiFixture),
      { profile: communityGaneshMumbaiFixture },
      5
    );

    // 2. menu x 5
    console.log('Testing Section: menu x 5 ...');
    newResults['Menu - Pune Wedding'] = await runNewPipelineSection(
      'Menu - Pune Wedding',
      MenuSectionSchema,
      () => buildMenuPrompt(weddingPuneFixture),
      { profile: weddingPuneFixture },
      5
    );

    // 3. category_tips x 5
    console.log('Testing Section: category_tips x 5 ...');
    const allowedCats = ['venue', 'catering', 'decor', 'photo_video'];
    newResults['Category Tips - Pune Wedding'] = await runNewPipelineSection(
      'Category Tips - Pune Wedding',
      CategoryTipsSectionSchema,
      () => buildCategoryTipsPrompt(weddingPuneFixture, allowedCats),
      { profile: weddingPuneFixture, allowedCategoryIds: allowedCats },
      5
    );

    // 4. narrate_diff x 5
    console.log('Testing Section: narrate_diff x 5 ...');
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
    newResults['Narrate Diff'] = await runNewPipelineSection(
      'Narrate Diff',
      NarrateDiffSectionSchema,
      () => buildNarrateDiffPrompt(diffFixture),
      { profile: weddingPuneFixture, diff: diffFixture },
      5
    );

    // 5. chat_intent x 5 different messages (3 patches, 2 questions)
    console.log('Testing Section: chat_intent x 5 messages ...');
    const chatMessages = [
      { label: 'Chat: Add 50k Catering', msg: 'Increase total catering budget by 50000' },
      { label: 'Chat: Guests to 250', msg: 'Change guest count to 250' },
      { label: 'Chat: Shift 1L Decor', msg: 'Shift 1 lakh from decor to photography' },
      { label: 'Chat: Question Attire', msg: 'What should guests wear for an evening Sangeet?' },
      {
        label: 'Chat: Question Favors',
        msg: 'What are traditional Maharashtrian wedding favors in Pune?',
      },
    ];

    const chatMetric: ProbeMetric = {
      section: 'Chat Intent (5 msgs)',
      totalRuns: 5,
      validCount: 0,
      latencies: [],
      finishReasons: {},
      repairs: 0,
      truncations: 0,
    };

    for (const item of chatMessages) {
      const t0 = Date.now();
      const prompt = buildChatIntentPrompt(weddingPuneFixture, item.msg);
      try {
        const res = await jarvisProvider.generateJson({
          system: prompt.system,
          user: prompt.user,
          schemaName: 'chat_intent',
          maxTokens: 2500,
          temperature: 0.2,
          timeoutMs: 20000,
        });
        chatMetric.latencies.push(Date.now() - t0);
        const finish = res.finishReason || 'stop';
        chatMetric.finishReasons[finish] = (chatMetric.finishReasons[finish] || 0) + 1;
        if (finish === 'length') chatMetric.truncations++;

        const parsed = extractJsonObject(res.text);
        const val = validateOutput(parsed, ChatIntentSectionSchema, {
          profile: weddingPuneFixture,
          userMessage: item.msg,
        });
        if (val.valid) {
          chatMetric.validCount++;
        }
      } catch {
        // error
      }
    }
    newResults['Chat Intent (5 msgs)'] = chatMetric;

    console.log('\nNEW PIPELINE RESULTS TABLE:');
    console.log(
      '| Section                      | Valid % | Avg Lat  | P50 Lat  | Max Lat  | Finish Reasons   | Repairs | Truncations |'
    );
    console.log(
      '|------------------------------|---------|----------|----------|----------|------------------|---------|-------------|'
    );
    for (const [name, m] of Object.entries(newResults)) {
      console.log(formatRow(name, m));
    }
  }

  // --- 5. GOOGLE GEMINI PLAIN + JSON PROBE ---
  if (GEMINI_API_KEY && GEMINI_MODEL) {
    console.log('\n--- 5. GOOGLE GEMINI PLAIN & STRUCTURED JSON ---');
    const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const t0 = Date.now();
    try {
      const res = await genai.models.generateContent({
        model: GEMINI_MODEL,
        contents: 'Reply in 5 words: What is Utsav?',
      });
      console.log(`Gemini Plain Latency: ${Date.now() - t0}ms | Response: "${res.text?.trim()}"`);

      const tJson = Date.now();
      const resJson = await genai.models.generateContent({
        model: GEMINI_MODEL,
        contents: 'Return 2 wedding tips in JSON: {"tips": [{"category": string, "tip": string}]}',
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
      console.log(
        `Gemini JSON Latency: ${Date.now() - tJson}ms | Response: ${resJson.text?.trim()}`
      );
    } catch (err: any) {
      const details = parseGemini429Details(err);
      if (err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED')) {
        console.log(`Gemini 429 Error Details:`);
        console.log(`  Message: ${err.message}`);
        console.log(`  Quota Metric: ${details.quotaMetric || 'unknown'}`);
        console.log(
          `  RetryDelay: ${details.retryAfterSeconds !== undefined ? `${details.retryAfterSeconds}s` : 'none'}`
        );
        console.log(`  Daily Quota: ${details.isDailyQuota}`);
        console.log('Gemini live: not verified (quota)');
      } else {
        console.log(`Gemini error: ${err.message}`);
      }
    }
  } else {
    console.log(
      '\n--- 5. GOOGLE GEMINI: SKIPPED (no GEMINI_API_KEY / GEMINI_MODEL configured) ---'
    );
  }

  // --- 6. SEARCH GROUNDING (IF ENABLED) ---
  if (GROUNDING_ENABLED && GEMINI_API_KEY && GEMINI_MODEL) {
    console.log('\n--- 6. GEMINI SEARCH GROUNDING ---');
    const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const t0 = Date.now();
    try {
      const res = await genai.models.generateContent({
        model: GEMINI_MODEL,
        contents: 'What are the dates for Ganesh Chaturthi 2027 in India?',
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      console.log(`Grounding Latency: ${Date.now() - t0}ms | Sources found: ${chunks.length}`);
    } catch (err) {
      console.log(`Grounding error: ${(err as Error).message}`);
    }
  } else {
    console.log('\n--- 6. GEMINI SEARCH GROUNDING: SKIPPED (GROUNDING_ENABLED is false) ---');
  }

  console.log('\n================================================================');
  console.log('   PROBE BENCHMARK COMPLETE');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Probe failed with unexpected error:', err.message);
  process.exit(1);
});
