# Phase 2.6: Honesty, Quality, and Safety Polish — Close-Out Report

> **Repository**: [https://github.com/CodeCatalyst-07/utsav_planner.git](https://github.com/CodeCatalyst-07/utsav_planner.git)  
> **Commit**: `5a4159c` (`main`)  
> **Live Deployed Vercel URL**: [https://utsavplanner-xi.vercel.app/](https://utsavplanner-xi.vercel.app/)  
> **Status**: Complete & Verified Green

---

## Executive Summary

Phase 2.6 delivers strict honesty, code quality, and security hardening across Utsav Planner without introducing any new features. Key accomplishments include:

1. **Honest Reasoning Baseline**: Live single-session probe measuring default thinking vs. thinking disabled (`{"chat_template_kwargs":{"enable_thinking":false}}`), proving a 2.7x–5.5x latency reduction with 100% first-attempt schema validity.
2. **Per-Section Reasoning Policy**: Implemented per-section control (`off` for fast sections, `default` for complex menu planning), verified via unit tests.
3. **Critic Honesty**: Responses omit `criticVerdict` and report `meta.critic = "skipped"` when the critic is disabled.
4. **Gemini Real Pipeline & Failover**: Successfully verified Gemini through production validators and demonstrated automatic failover when Jarvis credentials fail (strictly consuming only 4 Gemini calls within the 20 requests/day limit).
5. **Accuracy Sweep**: Corrected all UI design tokens (`#7A1F3D` primary, `#F59E0B` accent, `#FFF8F0` background; 10.04:1 contrast), stepper inputs, and 5-step wizard structure across all documentation.
6. **Code Quality Refactor**: All non-static files in `src/` are now under 400 lines (down from 1,253 lines max), 0 `any` types remain in `src/`, AI LRU cache capped at 200 entries, and code duplication reduced to 3.14% (threshold $\le 5\%$).
7. **Safety Hardening**: Reliable client IP detection prioritizing `x-vercel-forwarded-for`, daily IP rate limit quota (60 LLM calls/day), and client warning banner + server-side regex sanitization (`[removed]`) for phone numbers and email addresses.

---

## Part A: Fix the Record

### 1. Reasoning Baseline Explanation & Live Benchmark

#### Provenance of Discrepancy

In Phase 2.5, placeholder estimates (`1.65–2.1s`) were printed in `scripts/probe-llm.ts` (lines 334–364). Live measurements reveal that default reasoning with Jarvis thinking tokens actually requires **3.4s–7.0s**. All mock data has been removed.

#### Live Side-by-Side Probe Measurement

Measured in a single uninterrupted execution session using identical prompts, schemas, and live Jarvis API calls:

```
=== SIDE-BY-SIDE PROBE SUMMARY (5 runs each, identical prompts) ===
Section              Metric               Default Thinking     Thinking Off (enable_thinking:false) Speedup
------------------------------------------------------------------------------------------------------------------
ideas (Pune)         Valid / p50 / Max    100% | 5379ms | 6102ms  100% | 1708ms | 2104ms             3.1x faster
ideas (Indore)       Valid / p50 / Max    100% | 5468ms | 5890ms  100% | 1876ms | 2240ms             2.9x faster
ideas (Mumbai)       Valid / p50 / Max    100% | 5575ms | 6412ms  100% | 1825ms | 2301ms             3.1x faster
menu                 Valid / p50 / Max    100% | 7006ms | 7845ms  100% | 2619ms | 3102ms             2.7x faster
category_tips        Valid / p50 / Max    100% | 4845ms | 5320ms  100% | 1822ms | 2154ms             2.7x faster
narrate_diff         Valid / p50 / Max    100% | 3293ms | 3810ms  100% |  758ms |  912ms             4.3x faster
chat_intent (50 runs)Valid / p50 / Max    100% | 3414ms | 8193ms  100% |  622ms |  921ms             5.5x faster
```

_First-attempt validity: 100% across all sections (exceeds the $\ge 95\%$ adoption requirement)._

---

### 2. Per-Section Reasoning Policy

Implemented in `src/server/ai/sections.ts`:

```typescript
export const SECTION_REASONING_POLICY: Record<SectionName, 'off' | 'default'> = {
  ideas: 'off',
  category_tips: 'off',
  narrate_diff: 'off',
  chat_intent: 'off',
  menu: 'default',
};
```

In `src/server/ai/jarvis.ts`, request body merges the section policy with any global `JARVIS_EXTRA_BODY_JSON` override:

```typescript
const sectionPolicy = SECTION_REASONING_POLICY[options.section];
const extraBody = {
  ...(sectionPolicy === 'off' ? { chat_template_kwargs: { enable_thinking: false } } : {}),
  ...this.extraBody,
};
```

Unit test coverage added in `tests/unit/server/providers.test.ts`.

---

### 3. Critic Honesty

In `src/server/ai/critic.ts` and `src/server/ai/chain/metaBuilder.ts`, when `CRITIC_ENABLED=false`, `meta.critic` is set to `"skipped"` and `criticVerdict` is completely omitted.

#### Raw Meta with `CRITIC_ENABLED=false`

```json
{
  "provider": "jarvis",
  "model": "google/gemini-2.5-flash",
  "critic": "skipped",
  "attempts": 1,
  "repaired": false,
  "latencyMs": 1742
}
```

#### Raw Meta with `CRITIC_ENABLED=true`

```json
{
  "provider": "jarvis",
  "model": "google/gemini-2.5-flash",
  "critic": "ran",
  "criticVerdict": {
    "approved": true,
    "issues": []
  },
  "attempts": 1,
  "repaired": false,
  "latencyMs": 2894
}
```

---

### 4. Gemini Through the Real Production Pipeline & Failover

Called production endpoints with `ALLOW_PROVIDER_OVERRIDE=true` locally:

- **Ideas**: `meta.provider: "gemini"`, `attempts: 2`, `repaired: true` (repaired invalid category labels into canonical IDs), `latencyMs: 4579`.
- **Category Tips**: `meta.provider: "gemini"`, `attempts: 1`, `repaired: false`, all 9 canonical categories schema-valid.
- **Failover Demonstration**:

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "critic": "skipped",
  "attempts": 2,
  "skippedProviders": [],
  "repaired": false,
  "latencyMs": 3525
}
```

Attempt 1 (Jarvis with bad key) failed with `errorKind: "auth"`; `FailoverChain` switched to Gemini on Attempt 2 and succeeded. Exactly 4 Gemini requests were used in total, preserving the 20 requests/day free tier quota.

---

### 5. Accuracy Sweep

Audited and aligned all documentation with the actual code:

- **Design Tokens**: Primary `#7A1F3D` (10.04:1 contrast on white), Accent `#F59E0B`, Background `#FFF8F0`. Corrected previous false claims of `#D4AF37` and 9.45:1 contrast.
- **Wizard & UI Structure**: Documented 5-step wizard (Event, Date & City, Guests & Budget, Details & Priorities, Review & Generate) and steppers + numeric inputs (removed inaccurate mentions of sliders and non-existent vendor filter combobox).
- Updated `README.md`, `SECURITY.md`, `docs/accessibility.md`, and `docs/deployment.md`.

---

### 6. Real Challenge Expectations

Redone in `README.md` Section 2 with verifiable evidence, code links, and no self-assigned scores:

1. **Smart Dynamic Assistant**: Context-aware chat intent classification and patch application (`src/domain/schemas/intents.ts`, `tests/unit/domain/intents.test.ts`).
2. **Logical Decision Making Based on Context**: Culturally tuned budget splits, guest multiplier bands, and checklist milestones across 12 Indian cities (`src/domain/rules/`, `tests/unit/domain/`).
3. **Adaptive Behavior to Unexpected Changes**: Real-time What-If scenario simulations with atomic diff narration (`src/domain/rules/what-if.ts`, `tests/unit/rules/what-if-diff.test.ts`).
4. **Integration of Real-World Constraints**: Canonical category budget constraints, venue capacities, and Google Places vendor integration with fallback sample listings (`src/server/vendors/`, `tests/unit/server/vendors.test.ts`).
5. **Continuous Learning / Context Retention Across Sessions**: Resilient client-side persistence via `localStorage` with migration schema versioning (`src/context/plan-context.tsx`, `tests/unit/context/persistence.test.tsx`).

---

### 7. CI Verification

Verified `.github/workflows/ci.yml` runs the complete verification suite:

```yaml
- name: Unit Tests
  run: pnpm test
- name: AI Eval Suite
  run: pnpm eval
- name: Security Audit
  run: pnpm audit --prod
- name: Gitleaks Secret Detection
  uses: gitleaks/gitleaks-action@v2
- name: Playwright E2E Suite (including Console/CSP)
  run: pnpm exec playwright test --workers=1
```

---

## Part B: Code Quality Refactor

### 1. Monster File Audit & Single-Responsibility Splits

All files in `src/` now strictly conform to the `< 400` line threshold (excluding `src/domain/config/in/checklists.ts` pure static data):

```
     231 src/app/plan/budget/page.tsx
     387 src/app/plan/new/page.tsx
     273 src/app/plan/page.tsx
     328 src/app/plan/timeline/page.tsx
     375 src/app/plan/vendors/page.tsx
     287 src/app/plan/ask/page.tsx
     243 src/context/plan-context.tsx
     273 src/server/ai/chain.ts
      58 src/domain/config/in/data.ts
```

New modular components created:

- `src/components/wizard/`: `step-1-event.tsx`, `step-2-date-city.tsx`, `step-3-guests-budget.tsx`, `step-4-details.tsx`, `step-5-review.tsx`, `wizard-types.ts`
- `src/components/budget/`: `category-table.tsx`, `catering-card.tsx`, `tips-card.tsx`, `what-if-panel.tsx`, `assumptions-dialog.tsx`, `category-colors.ts`
- `src/components/vendors/`: `vendors-empty-state.tsx`, `menu-ideas-modal.tsx`, `vendor-checklist-item.tsx`
- `src/components/timeline/`: `timeline-item.tsx`, `timeline-progress-bar.tsx`, `timeline-empty-state.tsx`, `timeline-date-utils.ts`
- `src/components/plan/`: `plan-stat-blocks.tsx`, `ideas-card.tsx`, `plan-sidebar.tsx`, `plan-empty-state.tsx`
- `src/components/ask/`: `chat-message-item.tsx`, `ask-empty-state.tsx`, `chat-types.ts`
- `src/context/`: `plan-reducer.ts`
- `src/server/ai/chain/`: `attemptRunner.ts`, `metaBuilder.ts`, `types.ts`
- `src/domain/config/in/`: `budgetSplits.ts`, `cateringBands.ts`, `milestones.ts`, `checklists.ts`, `conditionals.ts`

---

### 2. Zero `any` Types Purge

```bash
$ grep -rn ": any" src/ --include="*.ts" --include="*.tsx"
# Result: 0 matches

$ grep -rn "as any" src/ --include="*.ts" --include="*.tsx"
# Result: 0 matches
```

All dynamic types narrowed to specific interfaces or `unknown` with runtime typeguards.

---

### 3. AI Cache LRU Cap (200 Entries)

Implemented in `src/server/ai/chain/attemptRunner.ts`:

- Enforces `MAX_CACHE_ENTRIES = 200`.
- Automatically evicts oldest keys when cache size exceeds limit.
- Verified by unit tests in `tests/unit/server/cache.test.ts`.

---

### 4. Duplication Audit

```bash
$ pnpm jscpd src/
Files analyzed:             54
Total lines of code:        16474
Duplicated lines:           518 (3.14%)
Duplication rate:           3.14% (Threshold: <= 5.0%)
```

The codebase contains only 3.14% duplication across 16,474 lines of code, well beneath the 5% upper limit.

---

## Part C: Safety Hardening

### 1. Rate Limiting Hardening

1. **IP Detection Order**: Checks `x-vercel-forwarded-for` first (guaranteed by Vercel infrastructure), followed by `x-forwarded-for` and `x-real-ip`.
2. **Daily LLM Quota**: Configured `LLM_DAILY_LIMIT` (default: 60 calls/day per client IP) to protect against bill shock on cloud deployments.
3. Unit tests pass in `tests/unit/server/security.test.ts`.

---

### 2. User Notes Privacy & Sanitization

1. **Client Warning**: Banner in `src/components/wizard/step-4-details.tsx` alerts users in real time when phone numbers or email patterns are detected.
2. **Server Masking**: `src/lib/pii.ts` redacts phone numbers and email addresses with `[removed]` before injecting notes into LLM prompts.
3. Unit tests pass in `tests/unit/lib/pii.test.ts`.

---

## Part D: Comprehensive Test & Build Verification

| Test Suite                   | Result               | Details                                             |
| :--------------------------- | :------------------- | :-------------------------------------------------- |
| **Vitest Unit Suite**        | **PASS** (412 / 412) | 41 test files green in 4.43s                        |
| **AI Eval Suite**            | **PASS** (58 / 58)   | Contract & poison tests green in 3.12s              |
| **Playwright E2E Suite**     | **PASS** (78 / 78)   | Includes 14/14 Console/CSP tests green              |
| **Next.js Production Build** | **PASS**             | Standalone production bundle verified               |
| **Smoke API Verification**   | **PASS** (5 / 5)     | `pnpm smoke:api --expect-ai` all returning `jarvis` |
| **Git Push to GitHub**       | **SYNCED**           | Commit `5a4159c` pushed to `origin/main`            |

---

## Conclusion & Deployment Status

Phase 2.6 has brought Utsav Planner to production-ready reliability, strict documentation honesty, zero type shortcuts, and hardened privacy controls. The live deployment at [https://utsavplanner-xi.vercel.app/](https://utsavplanner-xi.vercel.app/) is synchronized with the latest commit on `main`.
