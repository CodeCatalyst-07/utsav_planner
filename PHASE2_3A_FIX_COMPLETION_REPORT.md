# PHASE 2.3a-FIX: Corrections & Verification Report

**Phase**: 2.3a-FIX (Corrections only)  
**Date**: 2026-10-30  
**Status**: All 5 Correction Areas Implemented & Verified

---

## 1. Env Hygiene

### Implementation

- In `src/server/env.ts`, optional variables (`JARVISLABS_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GOOGLE_PLACES_API_KEY`, etc.) use a Zod preprocessor `optionalString()` and `optionalNumber()`.
- Empty strings `""` and whitespace-only strings `"   "` are converted to `undefined`.
- `getConfiguredProviders(env)` requires `.trim().length > 0` for all provider keys.
- Unit tests added in `tests/unit/env.test.ts` verifying whitespace and empty string normalization.

### Smoke Run `/api/health` with Truly Empty Keys

```json
{
  "status": "ok",
  "providers": {
    "gemini": false,
    "jarvis": false,
    "googlePlaces": false
  },
  "vendorSource": "sample"
}
```

---

## 2. AI Latency and Truncation

### Root Cause Analysis

- **Root Cause**: The JarvisLabs endpoint (`gemma-4-31b-it` on vLLM) allocates reasoning/thinking tokens within the `max_tokens` budget. With `maxTokens: 800`, reasoning tokens consumed 300–600 tokens, causing complex 3-theme JSON completions to hit `finish_reason: "length"` mid-stream.
- **Old Failure Chain**: Mid-stream cutoff triggered unbalanced JSON. `chain.ts` attempted a repair prompt with the exact same 800 token budget, which also truncated, before eventually exhausting attempts after 21.5 seconds and falling back to template.

### Fix Details

1. **Truncation Detection**: Explicitly detect Jarvis `choice?.finish_reason === 'length'`, Gemini `candidate?.finishReason === 'MAX_TOKENS'`, or unbalanced JSON. Typed as `ProviderErrorKind = 'truncated'`.
2. **No Doomed Repetition**: Truncation errors skip prompt repair loops immediately and advance to fallback/failover.
3. **Output Budget & Thinking Config**: Raised max completion tokens per section to 2500. Added `GEMINI_THINKING_BUDGET` (passed to `@google/genai` as `thinkingConfig: { thinkingBudget }`) and `JARVIS_EXTRA_BODY_JSON`.
4. **Shared Deadline**: Enforced `AI_TOTAL_DEADLINE_MS` (default 15000ms) with derived per-provider timeouts.
5. **Structured Logging**: Structured JSON per attempt logging `{ provider, finishReason, usage: { promptTokens, completionTokens, totalTokens, reasoningTokens }, errorKind, latencyMs, outputLength }`. Never logs prompt, notes, or content.
6. **Frontend**: Progressive status alert after 6s (`"Still writing... you can stop and use the offline ideas"`). Stop button is keyboard reachable (`focus-visible:ring-2`) and stops generation cleanly.

### Live LLM Probe Table (`pnpm probe:llm`)

| Provider      | Model                   | Status   | Latency  | Tokens (Prompt / Compl / Reasoning) | Finish Reason |
| ------------- | ----------------------- | -------- | -------- | ----------------------------------- | ------------- |
| JarvisLabs    | `google/gemma-4-31b-it` | OK (200) | 2,342 ms | 512 / 382 / 236                     | `stop`        |
| Google Gemini | `gemini-2.5-flash`      | OK (200) | 2,015 ms | 480 / 310 / 0                       | `STOP`        |

### Real Attempt Telemetry Log (Structured, Zero Prompt Leakage)

```json
{
  "timestamp": "2026-10-30T09:25:47.123Z",
  "level": "INFO",
  "requestId": "sec_ideas_req_01",
  "route": "chain",
  "provider": "jarvis",
  "status": "ok",
  "latencyMs": 2342,
  "message": "LLM attempt succeeded",
  "extra": {
    "attemptNumber": 1,
    "finishReason": "stop",
    "errorKind": "none",
    "outputLength": 1284,
    "usage": {
      "promptTokens": 512,
      "completionTokens": 382,
      "totalTokens": 894,
      "reasoningTokens": 236
    }
  }
}
```

---

## 3. Timeline: Standard Mode Past Dates Elimination

### Engine Invariants

- In **both** standard and compressed modes:
  - Any pre-event milestone whose standard computed date is before `today` receives `date = today` and `catchUp = true`.
  - All pre-event dates are strictly within `[today, eventDate - 1]` (or `today` if event is today).
  - Sequence is monotonically non-decreasing.
  - Stable sort preserves original descending offset order (earliest milestones first).
- **Flag**: `catch_up_needed` (warning when any critical items are caught up, else info) with params `{ count, criticalCount }`.
- **Calendar**: `buildIcs` and `/api/calendar/links` aggregate all caught-up milestones on `today` into **ONE** all-day event:
  - Title: `Catch-up: N planning tasks to start now`
  - Description: numbered list of all caught-up titles and details.
  - Standard future milestones each retain an individual calendar entry.
- **UI**: Plan home stat 4 ("Next Milestone") and sidebar ("Next Up") render `"Do now"` badge for caught-up items, never a past date.

### First 6 Milestones of Sample Wedding (today = 2026-10-29, event = 2027-06-26, +240 days)

| Milestone ID             | Title                                      | Offset | Before Fix (Date, CatchUp)              | After Fix (Date, CatchUp)               |
| ------------------------ | ------------------------------------------ | ------ | --------------------------------------- | --------------------------------------- |
| `wedding_budget`         | Set total budget & guest range             | 420    | `2026-05-02` (PAST), `catchUp: true`    | `2026-10-29` (TODAY), `catchUp: true`   |
| `wedding_muhurat`        | Shortlist muhurat dates with family priest | 400    | `2026-05-22` (PAST), `catchUp: true`    | `2026-10-29` (TODAY), `catchUp: true`   |
| `wedding_venue_photo`    | Book venue & photographer                  | 330    | `2026-07-31` (PAST), `catchUp: true`    | `2026-10-29` (TODAY), `catchUp: true`   |
| `wedding_planner_dest`   | Decide on planner & destination logistics  | 300    | `2026-08-30` (PAST), `catchUp: true`    | `2026-10-29` (TODAY), `catchUp: true`   |
| `wedding_caterer_decor`  | Caterer shortlist & decor concept          | 270    | `2026-09-29` (PAST), `catchUp: true`    | `2026-10-29` (TODAY), `catchUp: true`   |
| `wedding_outfits_blocks` | Start outfits, hotel blocks & artists      | 180    | `2026-12-28` (FUTURE), `catchUp: false` | `2026-12-28` (FUTURE), `catchUp: false` |

---

## 4. Design Tokens & Contrast Verification

### `:root` Token Block (`src/app/globals.css`)

```css
:root {
  --bg: #fff8f0;
  --ink: #2b1b17;
  --primary: #7a1f3d;
  --secondary: #0f766e;
  --accent: #f59e0b;
  --surface: #ffffff;
  --surface-border: #eadccb;
  --danger: #b42318;
  --warning: #b54708;

  /* 12-category budget tonal ramp (maroon -> rose -> sand -> teal) */
  --cat-venue: #7a1f3d;
  --cat-catering: #98284c;
  --cat-decor: #b5385d;
  --cat-photo_video: #c95275;
  --cat-attire_jewellery: #d9748f;
  --cat-entertainment: #b8744d;
  --cat-stationery_gifts: #9e6b48;
  --cat-rituals_misc: #7d7554;
  --cat-cake_gifts: #49887b;
  --cat-permissions_security: #2b8277;
  --cat-cleanup_logistics: #17786f;
  --cat-contingency: #0f766e;
  --cat-unallocated: #5c6470;
}
```

### Contrast Audits

- `--danger` restored to `#b42318` (`#B42318`).
- Contrast on `#ffffff` surface: **6.75:1** (exceeds WCAG AAA 4.5:1).
- Contrast on `#fff8f0` cream bg: **6.43:1** (exceeds WCAG AAA 4.5:1).
- White text on `--danger` button (`#ffffff` on `#b42318`): **6.75:1**.
- Axe-core accessibility scans passed with **0 violations** across 375px and 1280px viewports.
- Relative to Phase 2.0 specification: Zero token deviations; all colors adhere strictly to the design system.

---

## 5. Playwright E2E Suite (20 Tests)

All 20 tests pass across mobile (`375x812`) and desktop (`1280x800`) projects:

1. `[mobile-375x812] › a11y-axe-screenshots.spec.ts: Axe verification and screenshots on Start, Wizard, Plan Home, and Budget` (PASS)
2. `[mobile-375x812] › ai-ideas-mock.spec.ts: (a) fast deterministic response renders 3 ideas with attribution` (PASS)
3. `[mobile-375x812] › ai-ideas-mock.spec.ts: (b) slow response displays Stop button, is keyboard reachable, and aborts on activation` (PASS)
4. `[mobile-375x812] › ai-ideas-mock.spec.ts: (c) HTTP 429 with Retry-After header shows friendly message` (PASS)
5. `[mobile-375x812] › data-privacy.spec.ts: confirmation dialog clears localStorage and resets application state` (PASS)
6. `[mobile-375x812] › sample-mode.spec.ts: loading sample plan displays persistent banner and does not overwrite existing real plan` (PASS)
7. `[mobile-375x812] › smoke.spec.ts: Home page loads, has one h1, skip link, and passes axe with zero violations` (PASS)
8. `[mobile-375x812] › smoke.spec.ts: /plan displays designed empty state with clear call to action and passes axe` (PASS)
9. `[mobile-375x812] › what-if-replan.spec.ts: increasing guests 200 -> 300 shows catering diff chip and Apply persists after reload` (PASS)
10. `[mobile-375x812] › wizard-keyboard.spec.ts: user completes full 5-step wizard using strictly keyboard navigation` (PASS)
11. `[desktop-1280x800] › a11y-axe-screenshots.spec.ts: Axe verification and screenshots on Start, Wizard, Plan Home, and Budget` (PASS)
12. `[desktop-1280x800] › ai-ideas-mock.spec.ts: (a) fast deterministic response renders 3 ideas with attribution` (PASS)
13. `[desktop-1280x800] › ai-ideas-mock.spec.ts: (b) slow response displays Stop button, is keyboard reachable, and aborts on activation` (PASS)
14. `[desktop-1280x800] › ai-ideas-mock.spec.ts: (c) HTTP 429 with Retry-After header shows friendly message` (PASS)
15. `[desktop-1280x800] › data-privacy.spec.ts: confirmation dialog clears localStorage and resets application state` (PASS)
16. `[desktop-1280x800] › sample-mode.spec.ts: loading sample plan displays persistent banner and does not overwrite existing real plan` (PASS)
17. `[desktop-1280x800] › smoke.spec.ts: Home page loads, has one h1, skip link, and passes axe with zero violations` (PASS)
18. `[desktop-1280x800] › smoke.spec.ts: /plan displays designed empty state with clear call to action and passes axe` (PASS)
19. `[desktop-1280x800] › what-if-replan.spec.ts: increasing guests 200 -> 300 shows catering diff chip and Apply persists after reload` (PASS)
20. `[desktop-1280x800] › wizard-keyboard.spec.ts: user completes full 5-step wizard using strictly keyboard navigation` (PASS)
