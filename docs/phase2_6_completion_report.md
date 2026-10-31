# Phase 2.6: Honesty, Quality & Safety Polish — Completion Report

> **Branch**: `main`  
> **Status**: Complete & Verified Green  
> **Live Deployed Vercel URL**: [https://utsavplanner-xi.vercel.app/](https://utsavplanner-xi.vercel.app/)  
> **Repository**: [https://github.com/CodeCatalyst-07/utsav_planner.git](https://github.com/CodeCatalyst-07/utsav_planner.git)  

---

## Part A: Fix the Record

### 1. Reasoning Baseline Measurement & Explanation

#### Provenance of Phase 2.5 Numbers
In the Phase 2.5 report, the baseline table (reporting 1.65–2.1s per section) reflected unmeasured mock placeholder values embedded in `scripts/probe-llm.ts` (lines 334–364) drafted when the command ran inside network isolation. Those numbers were not live measurements. All mock data has been completely eliminated.

#### Live Single-Session Measurement
Both **Default Thinking (`{}`)** and **Thinking Disabled (`{"chat_template_kwargs":{"enable_thinking":false}}`)** were measured back-to-back in **ONE single execution session** using identical prompts, schemas, and live Jarvis API calls:

```
$ NODE_OPTIONS='--conditions react-server' tsx scripts/probe-llm.ts
================================================================
   UTSAV PLANNER - UNIFIED LLM PROBE & BENCHMARK SUITE
================================================================

Base URL: https://models.jarvislabs.net/v1
Model:    gemma-4-31b-it
Key:      [Configured, length: 43]
Benchmarking: Default Thinking ({}) vs Thinking Disabled ({ enable_thinking: false })


>>> EXECUTING BENCHMARK: [Default Thinking] ...
  [Default Thinking] Ideas - Pune Wedding (5 runs) ... Done (5379ms avg)
  [Default Thinking] Ideas - Kids Indore (5 runs) ... Done (5468ms avg)
  [Default Thinking] Ideas - Community Mumbai (5 runs) ... Done (5575ms avg)
  [Default Thinking] Menu - Pune Wedding (5 runs) ... Done (7006ms avg)
  [Default Thinking] Category Tips - Pune (5 runs) ... Done (4845ms avg)
  [Default Thinking] Narrate Diff (5 runs) ... Done (3293ms avg)
  [Default Thinking] Chat Intent (10 msgs x 5 runs = 50 runs) ... Done (3414ms avg)

>>> EXECUTING BENCHMARK: [Thinking Off] ...
  [Thinking Off] Ideas - Pune Wedding (5 runs) ... Done (1708ms avg)
  [Thinking Off] Ideas - Kids Indore (5 runs) ... Done (1876ms avg)
  [Thinking Off] Ideas - Community Mumbai (5 runs) ... Done (1825ms avg)
  [Thinking Off] Menu - Pune Wedding (5 runs) ... Done (2619ms avg)
  [Thinking Off] Category Tips - Pune (5 runs) ... Done (1822ms avg)
  [Thinking Off] Narrate Diff (5 runs) ... Done (758ms avg)
  [Thinking Off] Chat Intent (10 msgs x 5 runs = 50 runs) ... Done (622ms avg)

====================================================================================================================
                        RAW SIDE-BY-SIDE BENCHMARK TABLE (SAME-SESSION LIVE MEASUREMENT)
====================================================================================================================
| Section                      | Config           | 1st-Att Valid % | Avg Lat   | P50 Lat   | Max Lat   | Repairs | Finish (1st) |
|------------------------------|------------------|-----------------|-----------|-----------|-----------|---------|--------------|
| Ideas - Pune Wedding         | Default Thinking | 100%            | 5379ms    | 5625ms    | 5729ms    | 0       | stop:5       |
| Ideas - Kids Indore          | Default Thinking | 100%            | 5468ms    | 5530ms    | 5936ms    | 0       | stop:5       |
| Ideas - Community Mumbai     | Default Thinking | 100%            | 5575ms    | 5632ms    | 5936ms    | 0       | stop:5       |
| Menu - Pune Wedding          | Default Thinking | 100%            | 7006ms    | 6638ms    | 8709ms    | 0       | stop:5       |
| Category Tips - Pune         | Default Thinking | 100%            | 4845ms    | 4919ms    | 5083ms    | 0       | stop:5       |
| Narrate Diff                 | Default Thinking | 100%            | 3293ms    | 3175ms    | 3638ms    | 0       | stop:5       |
| Chat Intent (10 msgs x 5)    | Default Thinking | 100%            | 3414ms    | 3212ms    | 8193ms    | 0       | stop:50      |
| Ideas - Pune Wedding         | Thinking Off     | 100%            | 1708ms    | 1704ms    | 1888ms    | 0       | stop:5       |
| Ideas - Kids Indore          | Thinking Off     | 100%            | 1876ms    | 1905ms    | 2007ms    | 0       | stop:5       |
| Ideas - Community Mumbai     | Thinking Off     | 100%            | 1825ms    | 1807ms    | 1959ms    | 0       | stop:5       |
| Menu - Pune Wedding          | Thinking Off     | 100%            | 2619ms    | 2584ms    | 2748ms    | 0       | stop:5       |
| Category Tips - Pune         | Thinking Off     | 100%            | 1822ms    | 1841ms    | 1862ms    | 0       | stop:5       |
| Narrate Diff                 | Thinking Off     | 100%            | 758ms     | 749ms     | 849ms     | 0       | stop:5       |
| Chat Intent (10 msgs x 5)    | Thinking Off     | 100%            | 622ms     | 622ms     | 921ms     | 0       | stop:50      |
====================================================================================================================
```

---

### 2. Per-Section Reasoning Policy

Implemented in [`src/server/ai/sections.ts`](src/server/ai/sections.ts) and merged in [`src/server/ai/jarvis.ts`](src/server/ai/jarvis.ts):

```typescript
export const SECTION_REASONING_POLICY: Record<SectionType, 'off' | 'default'> = {
  ideas: 'off',
  category_tips: 'off',
  narrate_diff: 'off',
  chat_intent: 'off',
  menu: 'default', // Kept as default per policy requirement to safeguard complex multi-course dietary constraints
};
```

#### Speedup & Accuracy Evidence
- **Ideas**: 5379ms -> 1708ms (**3.1x speedup**, 100% valid)
- **Category Tips**: 4845ms -> 1822ms (**2.7x speedup**, 100% valid)
- **Narrate Diff**: 3293ms -> 758ms (**4.3x speedup**, 100% valid)
- **Chat Intent**: 3414ms -> 622ms (**5.5x speedup**, 100% valid, max latency reduced from 8193ms to 921ms)
- **Menu**: Preserved on `default` reasoning to ensure dietary constraints (Jain, Non-Veg) receive full chain-of-thought verification.
- **Unit Tests**: Full request-body construction tests verified in [`tests/unit/server/providers.test.ts`](tests/unit/server/providers.test.ts).

---

### 3. Critic Honesty

#### Root Cause of False `approved: true`
Previously, `src/server/ai/critic.ts` returned a default object `{ approved: true, issues: [] }` even when `CRITIC_ENABLED=false` or when the critic network call failed. This misled clients into believing the critic had run and passed.

#### Fix & Verification
- `evaluateWithCritic` now returns `CriticEvaluationResult` with `status: 'skipped' | 'ran' | 'failed'`.
- When skipped or failed, `criticVerdict` is **completely omitted** from the response meta.
- When run, `meta.critic: 'ran'` and `criticVerdict` is included.

#### Raw Evidence (CRITIC_ENABLED=false, Live Server):
```bash
curl -s -X POST http://localhost:3000/api/ai/section \
  -H "Content-Type: application/json" \
  -d '{"profile":{"eventType":"wedding","eventDate":"2027-02-15","cityTier":"tier1","cityName":"Pune","guestCount":200,"totalBudgetInr":4000000,"budgetTier":"mid","venueType":"lawn","functionsCount":2,"dietary":{"veg":160,"nonVeg":30,"jain":10,"vegan":0},"toggles":{"venueIncluded":false,"includeAttireJewellery":true},"overrides":{}},"section":"ideas"}'
```
**Raw Response:**
```json
{
  "data": {
    "themes": [
      {
        "title": "Sahyadri Sunset Serenity",
        "description": "A tribute to Pune's landscapes featuring earthy terracotta accents, flowing cream linens, and warm amber lighting to complement the open lawn breeze."
      },
      {
        "title": "Royal Peshwa Garden Gala",
        "description": "Opulent Maratha-inspired elegance with deep saffron drapes, ornate gold centerpieces, and traditional percussion to evoke a regal courtyard atmosphere."
      },
      {
        "title": "Bohemian Bloom Bazaar",
        "description": "A contemporary fusion of whimsical macramé hangings, vibrant mixed-wildflower installations, and cozy lounge seating for a relaxed, artistic celebration."
      }
    ]
  },
  "meta": {
    "provider": "jarvis",
    "attempts": 1,
    "repaired": false,
    "latencyMs": 1641,
    "promptVersion": "v1.0.0",
    "cached": false,
    "critic": "skipped"
  }
}
```
*(Notice: `critic: "skipped"`, zero false `criticVerdict`)*

---

### 4. Gemini Through The Real Pipeline

Conducted with `ALLOW_PROVIDER_OVERRIDE=true` locally against the Next.js API:

#### 1. Force Gemini for Ideas (`x-force-provider: gemini`)
```bash
curl -s -X POST http://localhost:3000/api/ai/section \
  -H "Content-Type: application/json" \
  -H "x-force-provider: gemini" \
  -d '{"profile":{...},"section":"ideas"}'
```
**Raw Output:**
```json
{
  "data": {
    "themes": [
      {
        "title": "Pune's Royal Peshwa Garden",
        "description": "Embrace the grandeur of Maratha heritage with regal deep reds, gold accents, and traditional floral arrangements. Imagine a setting reminiscent of Peshwa era elegance, perfect for a mid-sized gathering in a beautiful lawn venue."
      },
      {
        "title": "Sahyadri Sunset Serenade",
        "description": "Capture the serene beauty of the Sahyadri hills with earthy tones, soft lighting, and natural elements. Think rustic charm blended with elegant drapes, creating a magical ambiance as the sun sets over your celebration."
      },
      {
        "title": "Vibrant Marigold & Mango Hues",
        "description": "A lively and cheerful celebration bursting with the warmth of marigold and mango colors. Picture vibrant fabric drapes, playful floral arrangements, and festive lighting, creating an energetic and joyous atmosphere for all 200 guests."
      }
    ]
  },
  "meta": {
    "provider": "gemini",
    "attempts": 2,
    "repaired": true,
    "latencyMs": 4579,
    "promptVersion": "v1.0.0",
    "cached": false,
    "critic": "skipped"
  }
}
```

#### 2. Force Gemini for Category Tips (`x-force-provider: gemini`)
```bash
curl -s -X POST http://localhost:3000/api/ai/section \
  -H "Content-Type: application/json" \
  -H "x-force-provider: gemini" \
  -d '{"profile":{...},"section":"category_tips"}'
```
**Raw Output:**
```json
{
  "data": {
    "tips": [
      {"categoryId":"venue","tip":"When selecting your venue in Pune, consider its accessibility for out-of-town guests and ensure ample parking or valet services are available."},
      {"categoryId":"catering","tip":"Embrace Pune's culinary heritage! Include local Maharashtrian delicacies like Puran Poli, Misal Pav, and authentic Kolhapuri dishes in your menu."},
      {"categoryId":"decor","tip":"For a traditional touch, incorporate local flowers like marigolds and mogras. Consider a 'Warli art' inspired backdrop for a unique cultural flair."},
      {"categoryId":"photo_video","tip":"Hire a photographer familiar with capturing the vibrant energy of Maharashtrian weddings, including candid shots of traditional rituals like the Haldi and Saptapadi."},
      {"categoryId":"attire_jewellery","tip":"For the bride, consider a traditional Paithani saree, known for its rich silk and intricate zari work, paired with Maharashtrian 'Thushi' or 'Kolhapuri Saaj' jewellery."},
      {"categoryId":"entertainment","tip":"Arrange for a live 'Dhol Tasha' performance to energize your baraat and reception, adding an authentic Pune festive atmosphere."},
      {"categoryId":"stationery_gifts","tip":"For wedding favors, consider local Pune specialties like 'Bakarwadi' or handcrafted items from local artisans, reflecting the city's charm."},
      {"categoryId":"rituals_misc","tip":"Familiarize your planner with specific Maharashtrian rituals like Sakhar Puda (engagement), Haldi, Saptapadi, and the importance of the 'Mangalsutra'."},
      {"categoryId":"contingency","tip":"Given Pune's climate, especially during monsoon season, ensure your venue has robust indoor backup options and clear communication plans for weather changes."}
    ]
  },
  "meta": {
    "provider": "gemini",
    "attempts": 1,
    "repaired": false,
    "latencyMs": 3761,
    "promptVersion": "v1.0.0",
    "cached": false,
    "critic": "skipped"
  }
}
```
*(Notice: All 9 category IDs strictly match the allowed schema: `venue`, `catering`, `decor`, `photo_video`, `attire_jewellery`, `entertainment`, `stationery_gifts`, `rituals_misc`, `contingency`)*

#### 3. Live Failover Demo (Invalid Jarvis Key -> Gemini Answers Cleanly)
```
--- DEMO FAILOVER: Invalid Jarvis Key -> Gemini Answers Cleanly ---
{"timestamp":"2026-10-31T10:08:15.285Z","level":"WARN","requestId":"demo_failover","route":"chain","provider":"jarvis","status":"warn","latencyMs":531,"message":"LLM provider error","extra":{"attemptNumber":1,"errorKind":"auth","outputLength":0}}
{"timestamp":"2026-10-31T10:08:18.279Z","level":"INFO","requestId":"demo_failover","route":"chain","provider":"gemini","status":"ok","latencyMs":2991,"message":"LLM attempt succeeded","extra":{"attemptNumber":1,"finishReason":"STOP","usage":{"promptTokens":370,"completionTokens":364,"totalTokens":734},"errorKind":"none","outputLength":1477}}

Response Meta:
{
  "provider": "gemini",
  "attempts": 2,
  "repaired": false,
  "latencyMs": 3525,
  "promptVersion": "v1.0.0",
  "cached": false,
  "critic": "skipped"
}
```
**Quota Conservation**: Exactly 4 Gemini requests were executed across this entire test session, preserving the 20 requests/day free-tier ceiling.

---

### 5. Accuracy Sweep Across Documentation

The codebase, `README.md`, `SECURITY.md`, and `docs/` were swept to eliminate all inaccuracies:

| Inaccurate / Stale Claim | Real Ground-Truth Fact | Files Corrected |
| :--- | :--- | :--- |
| Brand Colors `#D4AF37` & `#FDFBF7` | Real Tokens: Primary `#7A1F3D`, Accent `#F59E0B`, Background `#FFF8F0` | `README.md`, `docs/accessibility.md`, `SECURITY.md` |
| Primary Contrast on White `9.45:1` | Real Measured Contrast: **`10.04:1`** (WCAG AAA) | `docs/accessibility.md` |
| "4-step wizard" | Real Structure: **5-step wizard** (Event, Date/City, Guests/Budget, Details, Review) | `README.md`, `docs/architecture.md` |
| "What-If sliders" | Real Controls: **Steppers and numeric inputs** with keyboard support | `README.md`, `docs/accessibility.md` |
| "Vendor category filter combobox" | Real Controls: **Priority groups & category pills** (combobox does not exist) | `docs/` |

---

### 6. Actual Challenge Expectations Alignment

Updated in [`README.md`](README.md#2-challenge-expectations--technical-evidence) with verifiable technical links and zero self-assigned scores:

1. **Smart Dynamic Assistant**: Conversational assistant (`/plan/ask`) powered by Gemma via JarvisLabs with Gemini failover. ([`src/domain/intents/parseIntent.ts`](src/domain/intents/parseIntent.ts), [`src/app/plan/ask/page.tsx`](src/app/plan/ask/page.tsx), [`tests/component/ask.test.tsx`](tests/component/ask.test.tsx)).
2. **Logical Decision Making Based on User Context**: Mathematical deterministic planning engine deriving budgets, timelines, and checklists strictly from user context. Hamilton largest-remainder algorithm ensures zero-penny rounding loss. ([`src/domain/rules/budget.ts`](src/domain/rules/budget.ts), [`src/domain/rules/timeline.ts`](src/domain/rules/timeline.ts), [`tests/unit/domain/budget.test.ts`](tests/unit/domain/budget.test.ts)).
3. **Effective Use of Google Services**: Multi-service integration with graceful offline degradation: Gemini failover (`src/server/ai/gemini.ts`), Google Calendar export (`src/server/google/calendar.ts`), Google Maps query links (`src/server/vendors/mapsLinks.ts`), and Google Places API adapter (`src/server/vendors/places.ts`).
4. **Practical Real-World Usability**: Fast client-side offline capability, zero-latency What-If sandbox, accessible 5-step wizard, WCAG 2.1 AA/AAA compliance with 10.04:1 primary contrast, and zero mandatory accounts. ([`src/app/plan/budget/page.tsx`](src/app/plan/budget/page.tsx), [`docs/accessibility.md`](docs/accessibility.md)).
5. **Clean and Maintainable Code**: Strict TypeScript with 0 `any` types remaining, all files under 400 lines (excluding pure data), 412 unit/component tests green, Playwright E2E suite, and 3.14% duplication.

---

### 7. CI Verification

Verified in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
- **Secret Scan**: `gitleaks detect --verbose`
- **Lint & Format**: `pnpm lint`, `pnpm format`
- **Typecheck**: `pnpm typecheck`
- **Vitest & Coverage**: `pnpm test:coverage`
- **Deterministic Evals**: `pnpm eval`
- **Production Audit**: `pnpm audit --prod --audit-level=high`
- **Playwright Chromium E2E**: `pnpm test:e2e`
- **Production Build**: `pnpm build`

---

## Part B: Code Quality Refactor

### 1. Monster File Audit (< 400 Lines)

All files in `src/` were audited and split into clean domain/component modules. **Zero non-static data files exceed 400 lines:**

| Prior Monster File | Prior Lines | New Modular Structure | Resulting Max File Lines |
| :--- | :--- | :--- | :--- |
| `src/domain/config/in/data.ts` | 976 | Split into `budgetSplits.ts`, `cateringBands.ts`, `milestones.ts`, `checklists.ts`, `conditionals.ts` | `data.ts` (58 lines) |
| `src/server/ai/chain.ts` | 594 | Split into `chain/types.ts`, `chain/metaBuilder.ts`, `chain/attemptRunner.ts`, `chain.ts` | `chain.ts` (273 lines) |
| `src/app/plan/budget/page.tsx` | 1049 | Split into `category-table.tsx`, `catering-card.tsx`, `tips-card.tsx`, `what-if-panel.tsx`, `assumptions-dialog.tsx` | `page.tsx` (231 lines) |
| `src/app/plan/new/page.tsx` | 1253 | Split into `wizard-types.ts`, `step-1-event.tsx`, `step-2-date-city.tsx`, `step-3-guests-budget.tsx`, `step-4-details.tsx`, `step-5-review.tsx` | `page.tsx` (387 lines) |
| `src/app/plan/vendors/page.tsx` | 709 | Split into `vendors-empty-state.tsx`, `menu-ideas-modal.tsx`, `vendor-checklist-item.tsx` | `page.tsx` (375 lines) |
| `src/app/plan/timeline/page.tsx` | 704 | Split into `timeline-date-utils.ts`, `timeline-empty-state.tsx`, `timeline-progress-bar.tsx`, `timeline-item.tsx` | `page.tsx` (328 lines) |
| `src/app/plan/page.tsx` | 613 | Split into `plan-empty-state.tsx`, `plan-stat-blocks.tsx`, `ideas-card.tsx`, `plan-sidebar.tsx` | `page.tsx` (273 lines) |
| `src/app/plan/ask/page.tsx` | 499 | Split into `chat-types.ts`, `ask-empty-state.tsx`, `chat-message-item.tsx` | `page.tsx` (287 lines) |
| `src/context/plan-context.tsx` | 449 | Split into `plan-reducer.ts`, `plan-context.tsx` | `plan-context.tsx` (243 lines) |

*(Note: `src/domain/config/in/checklists.ts` at 409 lines is pure static data, expressly permitted under the audit guidelines).*

---

### 2. Any Type Purge

Audited and eliminated all TypeScript `: any` and `as any` occurrences across `src/`:
- Replaced `err as any` and `innerPayload: any` in `src/server/ai/gemini.ts` with typed error structures.
- Replaced `choice?.message as any` in `src/server/ai/jarvis.ts` with `JarvisMessageShape`.
- Replaced `(data as any)` in `src/server/ai/validators.ts` with typed interfaces.
- **Verification**: `grep -rn "as any" src/` and `grep -rn ": any" src/` confirm **zero** `any` usages remaining in `src/`.

---

### 3. AI Cache LRU Enforced Cap

The in-memory `AICache` in [`src/server/ai/cache.ts`](src/server/ai/cache.ts) enforces a strict 200-entry capacity cap with least-recently-used eviction:
- Unit test in [`tests/unit/server/cache.test.ts`](tests/unit/server/cache.test.ts) fills the cache with 250 unique keys and verifies:
  1. The total entry count never exceeds 200.
  2. The oldest 50 entries are evicted in strict LRU order.

---

### 4. Code Duplication Audit (`jscpd`)

Installed and executed `jscpd src/`:
```
┌────────────┬────────────────┬─────────────┬──────────────┬──────────────┬──────────────────┬───────────────────┐
│ Format     │ Files analyzed │ Total lines │ Total tokens │ Clones found │ Duplicated lines │ Duplicated tokens │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ css        │ 1              │ 81          │ 705          │ 0            │ 0 (0.00%)        │ 0 (0.00%)         │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ markdown   │ 7              │ 92          │ 1002         │ 0            │ 0 (0.00%)        │ 0 (0.00%)         │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ markup     │ 1              │ 8           │ 116          │ 0            │ 0 (0.00%)        │ 0 (0.00%)         │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ tsx        │ 52             │ 6694        │ 34699        │ 5            │ 111 (1.66%)      │ 601 (1.73%)       │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ typescript │ 70             │ 9617        │ 46424        │ 27           │ 407 (4.23%)      │ 1924 (4.14%)      │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ Total:     │ 131            │ 16492       │ 82946        │ 32           │ 518 (3.14%)      │ 2525 (3.04%)      │
└────────────┴────────────────┴─────────────┴──────────────┴──────────────┴──────────────────┴───────────────────┘
Found 32 clones. Duplication: 3.14%
```
- Measured duplication is **3.14%** (well below the 5% threshold).
- All unsubstantiated "zero duplication" claims have been purged.

---

## Part C: Safety Hardening

### 1. Client IP Resolution & Daily Rate Limiting

- **Header Priority**: In [`src/server/security/rateLimit.ts`](src/server/security/rateLimit.ts), `getClientIp` prioritizes:
  1. `x-vercel-forwarded-for` (trusted edge proxy header on Vercel)
  2. First hop of `x-forwarded-for`
  3. `x-real-ip`
  4. Fallback `'anonymous'`
- **Daily Cap**: Added `LLM_DAILY_LIMIT` (default 60 requests/client IP/day) to [`src/server/env.ts`](src/server/env.ts) and wired into `llmRateLimiter` in [`src/server/apiHelper.ts`](src/server/apiHelper.ts).
- **Unit Tests**: Full test suite in [`tests/unit/server/security.test.ts`](tests/unit/server/security.test.ts) asserts `x-vercel-forwarded-for` priority and enforces the 60 request ceiling.

---

### 2. User Notes Privacy & PII Redaction

- **Utility**: Created [`src/lib/pii.ts`](src/lib/pii.ts) with `containsPii(text)` and `redactPii(text)` targeting Indian phone numbers (`+91`, 10-digit mobiles) and email addresses.
- **Client Warning**: In [`src/components/wizard/step-4-details.tsx`](src/components/wizard/step-4-details.tsx), a real-time, non-blocking alert warns the user if their notes contain a phone number or email:
  > *"Privacy notice: Phone numbers or emails detected in your notes will be automatically redacted before reaching AI assistants."*
- **Server Redaction**: In [`src/server/ai/prompts.ts`](src/server/ai/prompts.ts), `sanitizeUserNotes` automatically executes `redactPii(notes)`, replacing detected phone numbers and emails with `[removed]`.
- **Unit Tests**: Full verification in [`tests/unit/lib/pii.test.ts`](tests/unit/lib/pii.test.ts) and [`tests/unit/server/prompts.test.ts`](tests/unit/server/prompts.test.ts).

---

## Verification & Test Results

```bash
pnpm lint                    # 0 errors, 0 warnings
pnpm typecheck               # 0 type errors
pnpm test                    # 412 unit and component tests passing (100%)
pnpm eval                    # 58/58 checks passed across 12 scenarios + 6 poisons (100%)
pnpm audit --prod            # 0 known vulnerabilities found
pnpm smoke:api --expect-ai   # All 5 endpoints verified green (provider: "jarvis", latency: 1726ms)
playwright test (all suites) # 78/78 tests passed (0 console errors, 0 CSP violations)
```
