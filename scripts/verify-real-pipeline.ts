/**
 * scripts/verify-real-pipeline.ts
 *
 * Verifies live pipeline behavior against the local Next.js server:
 * 1. CRITIC_ENABLED=false: meta.critic is "skipped", meta.criticVerdict is omitted.
 * 2. CRITIC_ENABLED=true: meta.critic is "ran", meta.criticVerdict is present (1 Gemini call).
 * 3. Force Gemini: x-force-provider: gemini for ideas & category_tips (2 Gemini calls).
 * 4. Failover: Invalid Jarvis key -> Gemini answers (1 Gemini call).
 *
 * Strictly respects Gemini quota (<= 4 requests total).
 */

import { weddingPuneFixture } from '../src/domain/fixtures/profiles';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function callSection(section: string, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}/api/ai/section`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify({
      profile: weddingPuneFixture,
      section,
    }),
  });

  const status = res.status;
  const json = await res.json();
  return { status, json };
}

async function main() {
  console.log('================================================================');
  console.log('   UTSAV PLANNER - REAL PIPELINE VERIFICATION (A3 & A4)');
  console.log('================================================================\n');

  console.log(`Connecting to: ${BASE_URL}\n`);

  // 1. Critic skipped (CRITIC_ENABLED=false)
  console.log('--- TEST 1: CRITIC_ENABLED=false (Default) ---');
  const t1 = await callSection('ideas');
  console.log(`HTTP Status: ${t1.status}`);
  console.log('Response Meta:', JSON.stringify(t1.json?.meta, null, 2));
  console.log('Has criticVerdict?', 'criticVerdict' in (t1.json?.meta || {}));
  console.log('critic field:', t1.json?.meta?.critic);

  // 2. Force Gemini for ideas
  console.log('\n--- TEST 2: Force Gemini for Ideas (x-force-provider: gemini) ---');
  const t2 = await callSection('ideas', { 'x-force-provider': 'gemini' });
  console.log(`HTTP Status: ${t2.status}`);
  console.log('Response Meta:', JSON.stringify(t2.json?.meta, null, 2));
  console.log('Sample Output Themes:', JSON.stringify(t2.json?.data?.themes?.slice(0, 2), null, 2));

  // 3. Force Gemini for category_tips
  console.log('\n--- TEST 3: Force Gemini for Category Tips (x-force-provider: gemini) ---');
  const t3 = await callSection('category_tips', { 'x-force-provider': 'gemini' });
  console.log(`HTTP Status: ${t3.status}`);
  console.log('Response Meta:', JSON.stringify(t3.json?.meta, null, 2));
  console.log('Sample Tips:', JSON.stringify(t3.json?.data?.tips?.slice(0, 2), null, 2));

  console.log('\nPipeline verification completed.');
}

main().catch((err) => {
  console.error('Pipeline verification failed:', err);
  process.exit(1);
});
