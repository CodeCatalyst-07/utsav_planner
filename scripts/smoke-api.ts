/**
 * scripts/smoke-api.ts
 *
 * Verifies all Phase 2 API endpoints with no LLM / vendor keys configured.
 * Runs against Next.js production or dev server (default: http://localhost:3000).
 * Exits non-zero on any failure.
 */

import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const expectAi = process.argv.includes('--expect-ai') || process.env.EXPECT_AI === 'true';

// Compute dynamic future date (today + 360 days) to avoid hardcoded past date expiration
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 360);
const futureDateStr = futureDate.toISOString().split('T')[0];

const sampleProfile = {
  eventType: 'wedding',
  eventDate: futureDateStr,
  cityTier: 'tier1',
  cityName: 'Pune',
  guestCount: 200,
  totalBudgetInr: 4000000,
  budgetTier: 'mid',
  venueType: 'lawn',
  functionsCount: 2,
  dietary: {
    veg: 160,
    nonVeg: 30,
    jain: 10,
    vegan: 0,
  },
  toggles: {
    venueIncluded: false,
    includeAttireJewellery: true,
  },
  overrides: {},
  notes: 'Traditional Marathi wedding with Sangeet and reception dinner in Pune.',
};

function trimObject(obj: unknown, maxArrayLen = 2): unknown {
  if (Array.isArray(obj)) {
    const trimmed = obj.slice(0, maxArrayLen).map((item) => trimObject(item, maxArrayLen));
    if (obj.length > maxArrayLen) {
      trimmed.push(`... [${obj.length - maxArrayLen} more items truncated]`);
    }
    return trimmed;
  }
  if (obj !== null && typeof obj === 'object') {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = trimObject(v, maxArrayLen);
    }
    return res;
  }
  return obj;
}

async function ensureServerRunning(): Promise<ChildProcess | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (res.ok) return null; // already running
  } catch {
    // not running
  }

  if (!fs.existsSync('.next/BUILD_ID')) {
    console.log('No production build found. Running pnpm build ...');
    spawnSync('pnpm', ['build'], { stdio: 'inherit' });
  }

  console.log(`Starting production server on ${BASE_URL} ...`);
  const serverEnv: Record<string, string | undefined> = {
    ...process.env,
    PORT: '3000',
  };
  if (!expectAi && process.env.ASSERT_NO_KEYS === 'true') {
    serverEnv.JARVISLABS_API_KEY = '';
    serverEnv.GEMINI_API_KEY = '';
    serverEnv.GEMINI_MODEL = '';
    serverEnv.GOOGLE_PLACES_API_KEY = '';
  }

  const server = spawn('pnpm', ['start'], {
    env: serverEnv as NodeJS.ProcessEnv,
    stdio: 'pipe',
  });
  server.stderr?.on('data', (d) => process.stderr.write(d));
  server.stdout?.on('data', (d) => process.stdout.write(d));

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        console.log(`Server is ready!`);
        return server;
      }
    } catch {
      // wait and retry
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  server.kill('SIGTERM');
  throw new Error(`Server failed to start on ${BASE_URL} within 20 seconds.`);
}

async function runSmokeTests() {
  console.log(`\n======================================================`);
  console.log(
    `  UTSAV PLANNER API SMOKE TESTS (${expectAi ? 'Live AI Mode: --expect-ai' : 'Verification'})`
  );
  console.log(`  Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let serverProcess: ChildProcess | null = null;
  try {
    serverProcess = await ensureServerRunning();
  } catch (err) {
    console.error(`Failed to ensure server is running:`, err);
    process.exit(1);
  }

  let failureCount = 0;
  try {
    // 1. GET /api/health
    try {
      console.log(`[1/5] Testing GET /api/health ...`);
      const res = await fetch(`${BASE_URL}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      console.log(`  -> Status ${res.status}`);
      console.log(`  Response:`, JSON.stringify(data, null, 2));
      if (data.status !== 'ok') throw new Error(`Expected status: 'ok', got: ${data.status}`);
      if (process.env.ASSERT_NO_KEYS === 'true') {
        if (
          data.providers?.gemini !== false ||
          data.providers?.jarvis !== false ||
          data.providers?.googlePlaces !== false
        ) {
          throw new Error(
            `Expected all providers to be false when keys are unset, got: ${JSON.stringify(data.providers)}`
          );
        }
      }
    } catch (err) {
      console.error(`  FAIL [1/5] GET /api/health:`, err instanceof Error ? err.message : err);
      failureCount++;
    }

    // 2. POST /api/plan
    try {
      console.log(`\n[2/5] Testing POST /api/plan ...`);
      const res = await fetch(`${BASE_URL}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: sampleProfile }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      console.log(`  -> Status ${res.status}`);
      const trimmed = trimObject({
        plan: {
          mode: data.plan?.mode,
          daysToEvent: data.plan?.daysToEvent,
          budgetTotal: data.plan?.budget?.total,
          budgetLinesCount: data.plan?.budget?.lines?.length,
          sampleLines: data.plan?.budget?.lines?.slice(0, 3),
          timelineMilestonesCount: data.plan?.timeline?.milestones?.length,
          flagsCount: data.plan?.flags?.length,
        },
      });
      console.log(`  Response (trimmed):`, JSON.stringify(trimmed, null, 2));
      if (!data.plan || data.plan.budget.total !== 4000000) {
        throw new Error(`Invalid plan output: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.error(`  FAIL [2/5] POST /api/plan:`, err instanceof Error ? err.message : err);
      failureCount++;
    }

    // 3. POST /api/ai/section (section: ideas)
    try {
      console.log(`\n[3/5] Testing POST /api/ai/section (ideas) ...`);
      const res = await fetch(`${BASE_URL}/api/ai/section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: sampleProfile, section: 'ideas' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      console.log(`  -> Status ${res.status}`);
      console.log(`  Meta Provider: "${data.meta?.provider}"`);
      console.log(`  Themes generated: ${data.data?.themes?.length}`);
      console.log(`  Response:`, JSON.stringify(data, null, 2));

      if (expectAi) {
        if (data.meta?.provider === 'template') {
          throw new Error(
            `Expected meta.provider to be live AI ("jarvis" or "gemini") with --expect-ai, but got "template". Fallback reason: ${data.meta?.fallbackReason}`
          );
        }
      } else if (process.env.ASSERT_NO_KEYS === 'true') {
        if (data.meta?.provider !== 'template') {
          throw new Error(
            `Expected meta.provider to be "template" when no keys are configured, got "${data.meta?.provider}"`
          );
        }
      }
      if (!Array.isArray(data.data?.themes) || data.data.themes.length !== 3) {
        throw new Error(`Expected 3 theme ideas, got: ${data.data?.themes?.length}`);
      }
    } catch (err) {
      console.error(`  FAIL [3/5] POST /api/ai/section:`, err instanceof Error ? err.message : err);
      failureCount++;
    }

    // 4. GET /api/vendors
    try {
      console.log(`\n[4/5] Testing GET /api/vendors?categoryId=catering ...`);
      const res = await fetch(`${BASE_URL}/api/vendors?categoryId=catering&city=Pune&tier=tier1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      console.log(`  -> Status ${res.status}`);
      const trimmed = trimObject(data, 2);
      console.log(`  Response (trimmed):`, JSON.stringify(trimmed, null, 2));
      if (!data.vendors || data.vendors.length === 0) {
        throw new Error(`Expected vendor listings, got 0`);
      }
    } catch (err) {
      console.error(`  FAIL [4/5] GET /api/vendors:`, err instanceof Error ? err.message : err);
      failureCount++;
    }

    // 5. POST /api/calendar/ics
    try {
      console.log(`\n[5/5] Testing POST /api/calendar/ics ...`);
      const res = await fetch(`${BASE_URL}/api/calendar/ics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: sampleProfile }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const icsText = await res.text();
      const contentType = res.headers.get('content-type') || '';
      console.log(`  -> Status ${res.status}, Content-Type: ${contentType}`);
      const lines = icsText.split('\n');
      const preview =
        lines.slice(0, 10).join('\n') + `\n... [${lines.length - 10} lines truncated]`;
      console.log(`  Response (ICS Preview):\n${preview}`);
      if (!icsText.includes('BEGIN:VCALENDAR') || !icsText.includes('END:VCALENDAR')) {
        throw new Error('ICS response missing standard VCALENDAR boundaries');
      }
    } catch (err) {
      console.error(
        `  FAIL [5/5] POST /api/calendar/ics:`,
        err instanceof Error ? err.message : err
      );
      failureCount++;
    }
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }

  console.log(`\n======================================================`);
  if (failureCount > 0) {
    console.error(`  SMOKE TESTS FAILED: ${failureCount} failure(s) detected.`);
    console.log(`======================================================\n`);
    process.exit(1);
  } else {
    console.log(`  SMOKE TESTS PASSED: All 5 endpoints verified successfully.`);
    console.log(`======================================================\n`);
    process.exit(0);
  }
}

runSmokeTests().catch((e) => {
  console.error('Fatal smoke test runner error:', e);
  process.exit(1);
});
