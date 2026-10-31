/**
 * scripts/benchmark-ideas.ts
 *
 * Runs 5 real POST /api/ai/section { section: "ideas" } calls against the live Next.js server.
 * Prints raw response meta and wall-clock latencies (p50 and max).
 */

import { spawn, ChildProcess } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Read .env.local
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
        vars[trimmed.slice(0, idx).trim()] = trimmed
          .slice(idx + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
      }
    }
  }
  return vars;
}

const localEnv = loadEnvLocal();

const sampleProfile = {
  eventType: 'wedding',
  eventDate: '2027-10-30',
  cityTier: 'tier1',
  cityName: 'Pune',
  guestCount: 200,
  totalBudgetInr: 4000000,
  budgetTier: 'mid',
  venueType: 'lawn',
  functionsCount: 2,
  dietary: { veg: 160, nonVeg: 30, jain: 10, vegan: 0 },
  toggles: { venueIncluded: false, includeAttireJewellery: true },
  overrides: {},
  notes: 'Live benchmark wedding in Pune.',
};

async function main() {
  console.log('================================================================');
  console.log('  5 REAL POST /api/ai/section { section: "ideas" } BENCHMARK');
  console.log('================================================================');

  if (!localEnv.JARVISLABS_API_KEY && !localEnv.GEMINI_API_KEY) {
    console.log('not run: no keys in .env.local');
    process.exit(0);
  }

  if (!existsSync('.next/BUILD_ID')) {
    console.log('No production build found. Running pnpm build ...');
    const { spawnSync } = await import('node:child_process');
    spawnSync('pnpm', ['build'], { stdio: 'inherit' });
  }

  // Start Next.js server on port 3001 with .env.local variables
  console.log(`Starting Next.js on ${BASE_URL} ...`);
  const server: ChildProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    env: { ...process.env, ...localEnv, PORT: String(PORT) },
    stdio: 'inherit',
  });

  const deadline = Date.now() + 20000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((res) => setTimeout(res, 500));
    }
  }

  if (!ready) {
    server.kill();
    throw new Error('Failed to start server on port ' + PORT);
  }

  const results: Array<{ run: number; latencyMs: number; meta: any }> = [];

  for (let i = 1; i <= 5; i++) {
    // Add unique notes to bypass in-memory caching and force real live LLM call
    const runProfile = {
      ...sampleProfile,
      notes: `Live benchmark run #${i} - timestamp ${Date.now()}`,
    };

    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/ai/section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: runProfile, section: 'ideas' }),
    });

    const wallClockLatency = Date.now() - t0;
    const data = await res.json();
    results.push({
      run: i,
      latencyMs: wallClockLatency,
      meta: data.meta,
    });
    console.log(
      `Call ${i}/5: HTTP ${res.status} | Latency: ${wallClockLatency}ms | Provider: ${data.meta?.provider} | Finish: ${data.meta?.finishReason || 'N/A'} | Attempts: ${data.meta?.attempts}`
    );
  }

  server.kill('SIGTERM');

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length / 2)]!;
  const max = latencies[latencies.length - 1]!;

  console.log('\n--- BENCHMARK RESULTS ---');
  console.log(`p50 Latency: ${p50}ms`);
  console.log(`Max Latency: ${max}ms`);
  console.log('\nAll Response Metas:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
