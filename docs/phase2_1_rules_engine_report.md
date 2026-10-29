# Phase 2.1: Rules Engine Implementation Report

The deterministic rules engine ("smart assistant brain") for **[Utsav Planner](file:///Users/arnav/Desktop/event_planner/src/lib/brand.ts)** is complete. It is implemented in pure TypeScript within `src/domain/`, contains zero UI or network dependencies, makes zero LLM calls, and enforces strict mathematical and scheduling invariants.

---

## Step 0: Verification of Phase 2.0 Baseline

| Item  | Requirement                                               | Status   | File Reference                                                                                                                                                                                                               | Verification Summary                                                                                                                                                                                                                                                                                                            |
| :---- | :-------------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **a** | `src/server/env.ts` keys & memoization                    | **DONE** | [`src/server/env.ts`](file:///Users/arnav/Desktop/event_planner/src/server/env.ts)<br>[`tests/unit/env.test.ts`](file:///Users/arnav/Desktop/event_planner/tests/unit/env.test.ts)                                           | Provider keys are optional. `GEMINI_MODEL` required only if `GEMINI_API_KEY` is set; `GOOGLE_PLACES_API_KEY` required only when `VENDOR_SOURCE=places`. Lazy `getEnv()` memoization used. Error messages list variable names only (no values). Unit test passes with no keys.                                                   |
| **b** | `next.config.ts` CSP & headers                            | **DONE** | [`next.config.ts`](file:///Users/arnav/Desktop/event_planner/next.config.ts)<br>[`docs/decisions.md`](file:///Users/arnav/Desktop/event_planner/docs/decisions.md#adr-004-content-security-policy--inline-script-management) | `'unsafe-eval'` allowed only when `NODE_ENV !== 'production'`. `img-src 'self' data:`. HSTS `max-age=63072000; includeSubDomains` without `preload`. ADR-004 documents `'unsafe-inline'` necessity for Next.js hydration and future nonce-based roadmap.                                                                        |
| **c** | CI & Environment Example                                  | **DONE** | [`.github/workflows/ci.yml`](file:///Users/arnav/Desktop/event_planner/.github/workflows/ci.yml)<br>[`.env.example`](file:///Users/arnav/Desktop/event_planner/.env.example)                                                 | CI runs `pnpm exec playwright install --with-deps chromium` and `pnpm test:e2e`. `.env.example` contains only `your_key_here` and empty placeholders.                                                                                                                                                                           |
| **d** | Deleted Phase 1 reports & `pnpm-workspace.yaml`           | **DONE** | `PHASE1_SCAFFOLDING_REPORT.md` (deleted)<br>`docs/phase1_scaffolding_report.md` (deleted)                                                                                                                                    | Files deleted from repository. **`pnpm-workspace.yaml` explanation**: In pnpm v12, `pnpm-workspace.yaml` contains `allowBuilds: { esbuild: true, unrs-resolver: true }`. pnpm v12 requires approved build scripts to be declared in this file to avoid `ERR_PNPM_IGNORED_BUILDS` during installation; therefore it is retained. |
| **e** | Re-run contrast ratios including danger/warning on `--bg` | **DONE** | Output below                                                                                                                                                                                                                 | Calculated via WCAG relative luminance formula. Danger on `--bg` is **6.24:1** (AAA), Warning on `--bg` is **5.15:1** (AA). Both exceed the 4.5:1 text threshold.                                                                                                                                                               |

---

## 1. `src/domain` Folder Tree

```
src/domain
├── config
│   ├── in
│   │   ├── README.md
│   │   ├── SOURCES.md
│   │   ├── data.ts
│   │   ├── index.ts
│   │   └── messages.ts
│   └── types.ts
├── dates.ts
├── fixtures
│   └── profiles.ts
├── index.ts
├── money
│   └── inr.ts
├── rules
│   ├── README.md
│   ├── assumptions.ts
│   ├── budget.ts
│   ├── checklist.ts
│   ├── flags.ts
│   ├── plan.ts
│   ├── replan.ts
│   └── timeline.ts
└── schemas
    ├── README.md
    └── profile.ts
```

---

## 2. Verification Commands & Coverage Numbers

All commands pass cleanly with **zero warnings and zero errors**:

| Command              | Status            | Output Summary                                                                                                                                             |
| :------------------- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`          | **PASS (code 0)** | Zero ESLint errors. ESLint rule `no-restricted-imports` actively prevents any import of `next`, `react`, `server-only`, or `src/server` into `src/domain`. |
| `pnpm format`        | **PASS (code 0)** | All files strictly adhere to Prettier formatting.                                                                                                          |
| `pnpm typecheck`     | **PASS (code 0)** | Strict TypeScript compilation passes with `noUncheckedIndexedAccess: true`.                                                                                |
| `pnpm test:coverage` | **PASS (code 0)** | 12 test files, 79 unit and property tests pass in 1.17s. Global domain line coverage is **97.39%** (exceeding ≥ 90% threshold).                            |
| `pnpm build`         | **PASS (code 0)** | Production build succeeds in 919ms across all 10 static and dynamic routes.                                                                                |
| `pnpm test:e2e`      | **PASS (code 0)** | 6 Playwright tests pass across `mobile-375x812` and `desktop-1280x800` viewports with **zero Axe accessibility violations**.                               |

### Detailed Line Coverage Breakdown (`src/domain/`)

```
------------------|---------|----------|---------|---------|--------------------
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------|---------|----------|---------|---------|--------------------
All files         |   97.39 |    83.03 |   97.29 |   97.39 |
 domain           |     100 |    81.25 |     100 |     100 |
  dates.ts        |     100 |    81.25 |     100 |     100 | 30-32
 domain/config/in |   99.44 |    92.85 |    92.3 |   99.44 |
  data.ts         |     100 |      100 |     100 |     100 |
  index.ts        |   94.94 |       80 |     100 |   94.94 | 104-108
  messages.ts     |   95.45 |      100 |      90 |   95.45 | 11
 domain/money     |     100 |    94.87 |     100 |     100 |
  inr.ts          |     100 |    94.87 |     100 |     100 | 20,107
 domain/rules     |   93.81 |    77.83 |     100 |   93.81 |
  assumptions.ts  |     100 |    83.33 |     100 |     100 | 90
  budget.ts       |    93.1 |    81.35 |     100 |    93.1 | ...251-253,290,313
  checklist.ts    |     100 |       92 |     100 |     100 | 27,40
  flags.ts        |    87.4 |    72.72 |     100 |    87.4 | 85-99,146-147
  plan.ts         |     100 |      100 |     100 |     100 |
  replan.ts       |   90.22 |    69.38 |     100 |   90.22 | ...169-172,185-186
  timeline.ts     |   95.74 |    73.91 |     100 |   95.74 | 95-96,100-101
 domain/schemas   |     100 |      100 |     100 |     100 |
  profile.ts      |     100 |      100 |     100 |     100 |
------------------|---------|----------|---------|---------|--------------------
```

---

## 3. Summary of Three India Fixture Outputs (Frozen "today": `2026-10-29`)

### Fixture 1: Wedding in Pune

- **Profile**: Tier 1, Mid tier, 300 guests, 3 functions, ₹25,00,000 budget, Event date: `2027-02-14` (108 days away).
- **Timeline Mode**: `compressed` (108 days < 180 minimum lead days).
- **Milestones**: **11 milestones** (rescaled into `[2026-10-29, 2027-02-13]`; critical booking notices raised).
- **Budget Lines (₹25,00,000 exact sum, 0 unallocated)**:
  - Venue & Accommodation: ₹5,50,000 (22.0%)
  - Catering & Beverages: ₹6,25,000 (25.0%)
  - Decor, Mandap & Florals: ₹2,50,000 (10.0%)
  - Photography & Videography: ₹1,75,000 (7.0%)
  - Attire, Jewellery & Styling: ₹4,50,000 (18.0%)
  - Music, DJ & Entertainment: ₹1,00,000 (4.0%)
  - Invitations & Return Gifts: ₹75,000 (3.0%)
  - Pandit, Pooja Samagri & Logistics: ₹75,000 (3.0%)
  - Contingency Reserve: ₹2,00,000 (8.0%)
- **Checklist**: 18 items (includes conditional multi-function run-of-show and Jain kitchen counter items).
- **Flags (4)**:
  1. `compressed_plan` (warning): 108 days remaining vs 180 day recommendation.
  2. `peak_season` (info): February peak wedding season 15% rate multiplier.
  3. `dietary_mismatch` (info): 10 Jain guests identified; separate counter required.
  4. `wedding_muhurat_verify` (info): Confirm muhurat dates with family priest/panchang.

---

### Fixture 2: Kids 5th Birthday in Indore

- **Profile**: Tier 2, Mid tier, 40 guests, ₹60,000 budget, Event date: `2026-12-15` (47 days away), Home venue.
- **Timeline Mode**: `standard` (47 days ≥ 28 minimum lead days).
- **Milestones**: **6 milestones** (pre-event lead times from 42 days to 1 day).
- **Budget Lines (₹60,000 exact sum, 0 unallocated, venueIncluded toggle active)**:
  - Party Venue / Play Area: ₹0 (0.0% — derived: free home venue)
  - Catering & Snacks: ₹24,000 (40.0%)
  - Themed Decor & Balloons: ₹12,000 (20.0%)
  - Photography: ₹3,200 (5.3%)
  - Entertainer, Games & Host: ₹9,600 (16.0%)
  - Cake, Favors & Invitations: ₹7,200 (12.0%)
  - Contingency Reserve: ₹4,000 (6.7%)
- **Checklist**: 9 items (includes mandatory high-priority `safety_first_aid`).
- **Flags (1)**:
  1. `dietary_mismatch` (info): 5 Jain guests identified.

---

### Fixture 3: Community Ganeshotsav in Mumbai

- **Profile**: Tier 1, Budget tier, 500 guests, ₹4,00,000 budget, Event date: `2027-09-14` (320 days away), Community Hall.
- **Timeline Mode**: `standard` (320 days ≥ 70 minimum lead days).
- **Milestones**: **8 milestones** (6 pre-event starting at 84 days; 2 post-event: immersion at +1 day, accounts statement at +7 days).
- **Budget Lines (₹4,00,000 exact sum, 0 unallocated)**:
  - Prasad, Community Kitchen & Water: ₹80,000 (20.0%)
  - Pandal, Stage & Lighting: ₹1,00,000 (25.0%)
  - Sound System & Cultural Programs: ₹48,000 (12.0%)
  - Printing, Banners & Publicity: ₹16,000 (4.0%)
  - Idol, Pandit, Pooja & Samagri: ₹72,000 (18.0%)
  - Permits, Safety & Barricades: ₹32,000 (8.0%)
  - Immersion & Waste Cleanup: ₹28,000 (7.0%)
  - Emergency Reserve: ₹24,000 (6.0%)
- **Checklist**: 12 items (includes eco-idol artisan, volunteer coordinator, municipal barricades, and waste management).
- **Flags (3)**:
  1. `monsoon_outdoor` (warning): September is in monsoon window; canopy protection required.
  2. `dietary_mismatch` (info): 50 Jain guests identified.
  3. `community_permissions_verify` (info): Clearances required from police, municipality, electricity, and fire safety.

---

## 4. Key Architectural Implementations

1. **Integer Rupee & Largest Remainder Guarantee ([`src/domain/money/inr.ts`](file:///Users/arnav/Desktop/event_planner/src/domain/money/inr.ts))**:
   - `formatInr`: Formats numbers using standard Indian grouping (`₹12,34,567`).
   - `inrSpoken`: Converts integer amounts into accessible words for screen readers (e.g. `"rupees 2 crore 50 lakh"`).
   - `allocateLargestRemainder`: Implements Hamilton's allocation algorithm with deterministic index tie-breaking, proven via `fast-check` property tests to sum to total with 0 remainder across random inputs.
2. **Deterministic Timeline Scaling ([`src/domain/rules/timeline.ts`](file:///Users/arnav/Desktop/event_planner/src/domain/rules/timeline.ts))**:
   - Standard mode backward schedules milestones from event date.
   - Compressed mode scales pre-event offsets proportionally into `[today, eventDate - 1]`, maintaining non-decreasing dates and tagging milestones that were past in standard mode as `catchUp: true`.
3. **Pure Re-planning Diff ([`src/domain/rules/replan.ts`](file:///Users/arnav/Desktop/event_planner/src/domain/rules/replan.ts))**:
   - Produces strict diffs (`budgetLines`, `milestonesShifted`, `checklistAdded/Removed`, `flagsAdded/Removed`).
   - Generates deterministic `summaryFacts` representing only mathematically proven changes (the sole input to be provided to the future LLM for narrative generation).
4. **Security & Prompt Injection Resistance ([`tests/unit/domain/prompt_injection.test.ts`](file:///Users/arnav/Desktop/event_planner/tests/unit/domain/prompt_injection.test.ts))**:
   - `notes` field strips ASCII control characters and is strictly inert in all mathematical rules and timeline algorithms. Injection payloads cannot alter engine outputs.

---

## 5. Deviations & Open Questions

- **No Deviations**: All specifications implemented as requested.
- **Ready for Next Phase**: All domain logic and unit tests are in place. Standing by for Phase 2.2 instructions.
