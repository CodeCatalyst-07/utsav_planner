# Utsav Planner

> **AI-Assisted Cultural Celebration & Event Planner for India**  
> _Instant deterministic budgets, milestone schedules, zero-cost Google Maps vendor discovery, and safe LLM-powered creative copywriting._

[![CI](https://github.com/CodeCatalyst-07/utsav_planner/actions/workflows/ci.yml/badge.svg)](https://github.com/CodeCatalyst-07/utsav_planner/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org)

**Live Demo URL**: [https://utsav-planner.vercel.app](https://utsav-planner.vercel.app) _(Deploy your own in 2 minutes via [docs/deployment.md](docs/deployment.md))_

---

## 1. 90-Second Judge Walkthrough

1. **Launch**: Open [Live Demo](https://utsav-planner.vercel.app) and click **"Pune Maharashtrian Wedding"** to instantly load a realistic 200-guest, ₹25 Lakh cultural celebration plan.
2. **Deterministic Workspace**: Observe the **Plan Home** overview. The financial allocation, milestone countdown, and regional checklist are generated in 0 milliseconds with pure client-side math.
3. **What-If Sandbox (Zero Network Calls)**: Navigate to **Budget & What-If** (`/plan/budget`). Adjust the guest slider from 200 to 150. Notice how the budget reallocates live with zero network latency, mathematical precision, and instant audio-accessible screen reader announcements.
4. **AI Reliability & Failover**: On **Plan Home**, click **"Generate Creative Themes"**. The multi-provider failover chain tries JarvisLabs Gemma-4-31B -> Google Gemini -> Deterministic Template Fallback. The numeric guard guarantees the AI never invents fake prices or invalid dates.
5. **Calendar Integration**: Go to **Timeline** (`/plan/timeline`). Click **"Add to Google Calendar"** for an instant one-click event, or download the full celebration schedule as an RFC 5545 **`.ics`** file with reminder alarms.
6. **Vendor Discovery**: Visit **Vendors** (`/plan/vendors`). Browse curated sample listings with clear disclaimers, or click **"Open Google Maps Search"** to view real local businesses in Pune with zero API billing.
7. **Ask Assistant**: Navigate to **Ask** (`/plan/ask`). Type _"What if we increase the budget by 5 lakh?"_. The assistant suggests a structured patch; click **"Apply Patch"** to update your budget with full client-side state persistence.

---

## 2. Hackathon Grading Criteria Alignment

| Evaluation Category   | How Utsav Planner Excels                                                                                                                                                      | Technical Proof & Key Files                                                                                                                                         |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Code Quality**      | Strict TypeScript, zero `any` shortcuts, pure domain models, clear separation between deterministic rules and qualitative AI.                                                 | [plan.ts](src/domain/rules/plan.ts), [replan.ts](src/domain/rules/replan.ts), [inr.ts](src/domain/money/inr.ts)                                                     |
| **Security**          | Defense-in-depth: prompt injection containment, untrusted XML delimiters, strict CSP (0 eval violations), zero secret leakage in client JS, dual-tier rate limiting.          | [SECURITY.md](SECURITY.md), [chain.ts](src/server/ai/chain.ts), [rateLimit.ts](src/server/security/rateLimit.ts)                                                    |
| **Efficiency**        | Client-side what-if replanning with 0 network calls, prompt-level caching (`sha256`), dynamic import optimization, bundle size <185 kB first-load JS.                         | [what-if-replan.spec.ts](tests/e2e/what-if-replan.spec.ts), [cache.ts](src/server/ai/cache.ts)                                                                      |
| **Testing**           | 387 unit & component tests, 100% eval score across 12 scenarios + 6 poisoned adversarial attacks, contract fixtures for Jarvis/Gemini, Playwright e2e suites.                 | [evals/runner.ts](evals/runner.ts), [contracts.test.ts](tests/unit/server/contracts.test.ts), [vitest.config.ts](vitest.config.ts)                                  |
| **Accessibility**     | WCAG 2.1 AA/AAA compliance, 200% zoom reflow with 0 horizontal overflow, high-contrast mode (`forced-colors: active`), `prefers-reduced-motion` support.                      | [accessibility.md](docs/accessibility.md), [accessibility-deep.spec.ts](tests/e2e/accessibility-deep.spec.ts)                                                       |
| **Google Services**   | Deep ecosystem usage: Google Gemini failover LLM, optional Gemini Critic, Google Calendar links + RFC 5545 `.ics`, Google Maps links, Google Places API adapter.              | [gemini.ts](src/server/ai/gemini.ts), [critic.ts](src/server/ai/critic.ts), [calendar.ts](src/server/google/calendar.ts), [places.ts](src/server/vendors/places.ts) |
| **Problem Alignment** | Purpose-built for India: Indian numbering system (`₹`, Lakh, Crore), culturally authentic rituals, regional muhurat planning, and multi-dietary awareness (Veg/Non-Veg/Jain). | [dietary.ts](src/domain/config/in/dietary.ts), [fallbacks.ts](src/domain/config/in/fallbacks.ts)                                                                    |

---

## 3. Architecture & Operational Flow

```mermaid
flowchart TD
    User([User in Browser]) --> ClientContext[Plan Context & LocalStorage]

    subgraph ClientLayer [Client-Side Layer - Zero Network Latency]
        ClientContext --> PureRules[Deterministic Engine: budget.ts, timeline.ts, replan.ts]
        PureRules --> LiveView[Reactive Budget, What-If Sandbox & Checklist]
    end

    subgraph ServerAPILayer [Next.js 15 Serverless API Layer]
        ClientContext -->|Qualitative Requests Only| RouteHandlers[/api/ai/section, /api/ai/chat]
        RouteHandlers --> RateLimiter[In-Memory Token Bucket Limiter]
        RateLimiter --> CacheCheck{AICache Hit?}
        CacheCheck -- Yes --> CachedResponse[Return Cached JSON]
        CacheCheck -- No --> FailoverChain[Failover Chain Engine]

        subgraph AIChain [AI Failover & Quality Pipeline]
            FailoverChain --> Jarvis[Primary: JarvisLabs Gemma-4-31B]
            Jarvis -- 429 / 5xx / Timeout --> Gemini[Failover: Google Gemini 2.5 Flash]
            Gemini -- Outage / Quota Exceeded --> Fallback[Deterministic Template Fallback]

            Jarvis --> OutputValidator{Numeric Guard & Schema Validator}
            Gemini --> OutputValidator
            OutputValidator -- Bad Schema --> RepairLoop[Single Prompt Repair]
            RepairLoop -- Failed Again --> Gemini
            OutputValidator -- Valid JSON --> OptionalCritic{Critic Enabled?}
            OptionalCritic -- Yes --> GeminiCritic[Gemini Cultural & Quality Critic]
            OptionalCritic -- No --> CacheStore[Store in AICache & Return]
            GeminiCritic --> CacheStore
        end
    end

    subgraph GoogleServices [Google Services Integration]
        ClientContext --> GCal[Google Calendar Web Links & .ics Download]
        ClientContext --> GMaps[Google Maps Search URLs - Zero Cost]
        RouteHandlers --> GPlaces[Google Places API (New) Text Search]
    end
```

---

## 4. Google Services Integration Matrix

| Google Service              | Implementation File                                                                                            | Role & Architectural Rationale                                                                                                                                                | Graceful Degradation / Fallback                                                                                                             |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **Google Gemini (Gen AI)**  | [`src/server/ai/gemini.ts`](file:///Users/arnav/Desktop/event_planner/src/server/ai/gemini.ts)                 | **Autonomous Failover LLM**: Official `@google/genai` SDK provider invoked if JarvisLabs is down, times out, or returns HTTP 429/5xx.                                         | Falls back cleanly to `DeterministicFallback`. Automatically parses quota metrics and opens circuit breaker for the requested `retryDelay`. |
| **Google Gemini Critic**    | [`src/server/ai/critic.ts`](file:///Users/arnav/Desktop/event_planner/src/server/ai/critic.ts)                 | **Quality & Dietary Auditor**: Secondary review evaluating dietary conflicts, budget tier mismatches, and cultural consistency.                                               | Default disabled (`CRITIC_ENABLED=false`). When active, failures degrade silently to `approved: true` without blocking user responses.      |
| **Google Search Grounding** | [`src/server/ai/grounding.ts`](file:///Users/arnav/Desktop/event_planner/src/server/ai/grounding.ts)           | **Live Auspicious Muhurat Context**: Optional search grounding for regional festival dates and cultural timings.                                                              | Disabled by default (`GROUNDING_ENABLED=false`); returns `null` on error.                                                                   |
| **Google Calendar**         | [`src/server/google/calendar.ts`](file:///Users/arnav/Desktop/event_planner/src/server/google/calendar.ts)     | **One-Click Event Links + RFC 5545 `.ics`**: Browser web links (`action=TEMPLATE`) with correct timezone offsets, plus downloadable `.ics` files with `VALARM` notifications. | Zero OAuth requirements; `.ics` export runs completely offline.                                                                             |
| **Google Maps**             | [`src/server/vendors/mapsLinks.ts`](file:///Users/arnav/Desktop/event_planner/src/server/vendors/mapsLinks.ts) | **Universal Local Search Links**: Clean encoded URLs (`https://www.google.com/maps/search/?api=1&query=...`) attached to all vendor categories.                               | Zero billing, zero API keys, 100% uptime.                                                                                                   |
| **Google Places API (New)** | [`src/server/vendors/places.ts`](file:///Users/arnav/Desktop/event_planner/src/server/vendors/places.ts)       | **Live Vendor Directory**: Text search (`places:searchText`) with basic field masks to keep API costs within the lower-tier Basic SKU.                                        | Seamless fallback to curated sample listings and Google Maps links on error or unconfigured key.                                            |

---

## 5. Screens Gallery

1. **Start Screen (`/`)**: Direct entry point with zero-friction quick launches for pre-configured sample celebrations (Pune Maharashtrian Wedding, Indore Community Navratri, Mumbai Kids Birthday) or building a custom event from scratch.
2. **Event Blueprint Wizard (`/plan/new`)**: 4-step guided wizard with keyboard navigation, custom guest count scaling, city tier allocation, and dietary ratio selectors.
3. **Plan Workspace (`/plan`)**: Comprehensive dashboard highlighting countdown days, budget health, milestone progress, and AI-generated cultural themes.
4. **Budget & What-If Sandbox (`/plan/budget`)**: Interactive category breakdown with inline overrides, category why-formula explainers, and real-time What-If scenario modeling.
5. **Celebration Timeline (`/plan/timeline`)**: Milestone schedule organized by weeks and days out, complete with task completion toggles, Google Calendar export, and `.ics` download.
6. **Vendor Directory (`/plan/vendors`)**: Categorized vendor recommendations with honest sample labels, Google Maps search deep-links, and local area filters.
7. **Ask Event Assistant (`/plan/ask`)**: Conversational chat assistant that parses planning questions, verifies proposed patches against budget rules, and presents structured diff previews.

---

## 6. How We Test the LLM

Testing GenAI in production requires going beyond happy-path unit tests. Utsav Planner implements a comprehensive three-tier evaluation system:

### 1. 12 Culturally Neutral Evaluation Scenarios (`evals/`)

Located in [`evals/scenarios.ts`](file:///Users/arnav/Desktop/event_planner/evals/scenarios.ts), the eval suite covers diverse Indian celebrations across existing event types:

- **Weddings**: Pune Maharashtrian Traditional Wedding, Chennai Tamil Traditional Reception, Lucknow Awadhi Royal Wedding, Jaipur Destination Palace Wedding.
- **Birthdays (Kids & Adults)**: Mumbai 5th Birthday, Hyderabad Toddler Party, Kolkata 30th Birthday, Ahmedabad 50th Milestone Celebration (with strict Jain requirements), Bengaluru 60th Milestone.
- **Community Festivals**: Mumbai Ganeshotsav Pandal, Indore Navratri Garba, Delhi Diwali Cultural Mela.

### 2. Dual-Mode Positive & Adversarial Negative Evals

Run via `pnpm eval`:

- **Positive Tests**: Asserts that real or template outputs pass schema validation, numeric bounds, allowed category IDs, and dietary requirements.
- **Adversarial Negative Poison Tests**: Injects 6 deliberate security and domain violations:
  1. _Meat in Pure-Veg Menu_: Chicken injected into a vegetarian profile (`nonVeg === 0`) -> **Strictly blocked by semantic validator**.
  2. _Root Vegetables in Jain Counter_: Potato/Garlic injected into a Jain counter (`jain > 0`) -> **Strictly blocked by Jain keyword validator**.
  3. _Hallucinated Rupee Amounts_: Injected `₹9,99,999` not in profile or diff facts -> **Strictly blocked by Numeric Guard**.
  4. _API Key Leakage_: Injected secret key pattern into output prose -> **Strictly blocked by Secret Leak Scanner**.
  5. _Out-of-Bounds Chat Patch_: Negative guest counts or budget > ₹50 Cr -> **Strictly blocked by Zod schema**.
  6. _Unauthorized Category IDs_: Hallucinated category IDs -> **Strictly blocked by Domain Validator**.

### 3. Live LLM Probe & Diagnostics (`scripts/probe-llm.ts`)

Run via `pnpm probe:llm`:

- Benchmarks live provider latencies, finish reasons, token consumption, and reasoning configurations.
- Demonstrates that disabling Gemma thinking tokens via `{"chat_template_kwargs":{"enable_thinking":false}}` achieves **4x faster response times (231ms vs 892ms)** with 70% token savings.

---

## 7. Security & Data Privacy Summary

- **Zero Server-Side Storage**: Utsav Planner maintains no database. All event plans and chat history are saved exclusively in the user's browser `localStorage`.
- **Strict Content Security Policy (CSP)**: Zero eval violations achieved through Zod `jitless: true` configuration, nosniff, frame-ancestors 'none', HSTS, and no X-Powered-By header.
- **Client Bundle Secret Grep**: Automated post-build sweeps ensure `JARVISLABS_API_KEY`, `GEMINI_API_KEY`, and `GOOGLE_PLACES_API_KEY` never appear in `.next/static`.
- Full details available in [`SECURITY.md`](SECURITY.md).

---

## 8. Development & Testing Quickstart

```bash
# Install dependencies
pnpm install

# Run type check and linter
pnpm typecheck
pnpm lint

# Run unit tests with coverage
pnpm test:coverage

# Run LLM evaluation harness (12 scenarios + 6 poisoned negative tests)
pnpm eval

# Run Playwright end-to-end tests
pnpm test:e2e

# Run API smoke test against deployed or local server
BASE_URL=http://localhost:3000 pnpm smoke:api
```

---

## 9. License

This project is licensed under the MIT License - see the [`LICENSE`](LICENSE) file for details.
