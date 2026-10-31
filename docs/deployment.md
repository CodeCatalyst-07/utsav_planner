# Production Deployment Guide (Vercel)

## Architecture Overview

Utsav Planner deploys as a **single unified Next.js 15 project** on Vercel. It requires **no separate backend, no external database, and no server state**. All financial math, milestone schedules, and vendor lookups run either in-memory or purely in the client browser (`localStorage`).

---

## Prerequisites

- A GitHub repository connected to [Vercel](https://vercel.com).
- Node.js >= 20.0.0 and `pnpm >= 9.0.0` (packaged with `pnpm@12.15.0`).
- (Optional) API keys for live AI features:
  - **JarvisLabs** (`gemma-4-31b-it` OpenAI-compatible endpoint)
  - **Google Gemini** (`gemini-2.5-flash` or `gemini-1.5-flash`)
  - **Google Places API (New)** (for real local vendor search)

---

## Step-by-Step Vercel Deployment

### 1. Import Project into Vercel

1. Log in to the [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Select the repository `utsav_planner` and click **Import**.
4. Framework Preset: **Next.js** (auto-detected).
5. Root Directory: `./` (default).

### 2. Configure Environment Variables

In the Vercel Project Settings under **Environment Variables**, configure the production values:

| Variable                  | Type    | Required | Recommended Production Value       | Description                                                                                          |
| :------------------------ | :------ | :------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `JARVISLABS_API_KEY`      | Secret  | Optional | `your_jarvis_key`                  | Primary LLM provider key for Gemma-4-31B.                                                            |
| `JARVIS_BASE_URL`         | String  | Optional | `https://models.jarvislabs.net/v1` | JarvisLabs OpenAI-compatible endpoint.                                                               |
| `JARVIS_MODEL`            | String  | Optional | `gemma-4-31b-it`                   | Primary fast reasoning/instruction model.                                                            |
| `JARVIS_JSON_MODE`        | String  | Optional | `prompt_only`                      | Prompts enforce balanced JSON without server-side grammar constraints.                               |
| `JARVIS_EXTRA_BODY_JSON`  | JSON    | Optional | `{}`                               | Recommended `{}`. Leaving thinking enabled preserves 100% menu validity (disabling drops it to 80%). |
| `GEMINI_API_KEY`          | Secret  | Optional | `your_gemini_key`                  | Optional failover LLM key. Free tier allows 20 req/day. Jarvis is primary, Gemini is failover.       |
| `GEMINI_MODEL`            | String  | Optional | `gemini-2.5-flash`                 | Gemini model ID.                                                                                     |
| `CRITIC_ENABLED`          | Boolean | Optional | `false`                            | Defaults to `false` to conserve Gemini daily quota. Enable once quota is confirmed.                  |
| `GROUNDING_ENABLED`       | Boolean | Optional | `false`                            | Optional Google Search grounding for Gemini.                                                         |
| `GOOGLE_PLACES_API_KEY`   | Secret  | Optional | `your_places_key`                  | Optional Google Places API (New) key for real vendor search.                                         |
| `VENDOR_SOURCE`           | String  | Optional | `sample`                           | Defaults to zero-cost fictional curated listings. Set to `places` when key is present.               |
| `ALLOW_PROVIDER_OVERRIDE` | Boolean | Optional | `false`                            | Security guard: prevents external users from bypassing provider chain via headers.                   |
| `RATE_LIMIT_PER_MIN`      | Number  | Optional | `10`                               | In-memory token bucket rate limit per client IP for AI routes.                                       |
| `AI_TOTAL_DEADLINE_MS`    | Number  | Optional | `15000`                            | Hard 15-second end-to-end deadline before Vercel gateway timeout.                                    |

### 3. Deploy

Click **Deploy**. Vercel will run `pnpm build` (which includes full static generation of 19 prerendered pages and zero secret leakage validation).

---

## Region & Timeout Configuration (`vercel.json`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["bom1"]
}
```

> [!NOTE] Vercel Serverless Regions
> The `bom1` (Mumbai, India) region colocates serverless functions closest to Indian celebration users.
> **Plan Verification Note**: Custom serverless regions require a Vercel Pro team plan or verified Hobby plan account. If deploying to an unverified Hobby account, remove the `"regions"` key to allow Vercel to route automatically (defaults to `iad1` Washington DC).

### Serverless Execution Timeout (`maxDuration`)

- Next.js AI endpoints (`/api/ai/section` and `/api/ai/chat`) export `export const maxDuration = 30;`.
- On Vercel Hobby plans, the maximum execution duration is 60 seconds (default 10s-15s).
- Utsav Planner enforces a strict internal deadline of `AI_TOTAL_DEADLINE_MS = 15000` (15 seconds), guaranteeing that any failing or slow LLM gracefully falls back to deterministic templates well before the serverless execution limit.

---

## Verifying a Deployed Production URL

Once deployed, verify your live URL (e.g. `https://utsav-planner.vercel.app`):

### 1. API Smoke Test (Zero Secrets Exposed)

```bash
BASE_URL=https://your-deployment.vercel.app pnpm smoke:api
```

Tests:

- `GET /api/health` -> confirms 200 OK and provider status.
- `POST /api/plan` -> verifies deterministic engine calculation.
- `POST /api/ai/section` -> confirms failover chain and template fallback.
- `GET /api/vendors` -> verifies sample vendor directory.
- `POST /api/calendar/ics` -> verifies valid RFC 5545 iCalendar generation.

### 2. End-to-End Smoke Test

```bash
BASE_URL=https://your-deployment.vercel.app pnpm test:e2e:prod
```

Tests:

- Start screen loads with 1 h1, skip link, and passes axe accessibility with 0 violations.
- Plan workspace displays clean empty state with accessible CTA.
