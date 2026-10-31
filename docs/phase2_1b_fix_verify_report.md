# Phase 2.1b: Fix and Verify Report

All corrections, verifications, test coverage expansions, and fixture updates for **Phase 2.1b** are complete. Pure TypeScript domain logic in `src/domain/` operates with zero framework dependencies, zero network/I/O, UTC date-only math, and integer rupee arithmetic.

---

## 1. Catering Verification Table

| Fixture                                                 | perPlate Band Used (Min / High)           | Functions Factor Formula & Value | Season Factor Formula & Value | Guests | Low / Mid / High Estimates                              | Allocated Catering Line           | Status   | Suggestions                                                                  | All Active Flags                                                                                                                                           |
| :------------------------------------------------------ | :---------------------------------------- | :------------------------------- | :---------------------------- | :----- | :------------------------------------------------------ | :-------------------------------- | :------- | :--------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wedding Default** (`weddingPuneFixture`)              | Tier 1 Mid: ₹1,200 – ₹2,500 (Mid: ₹1,850) | $1.0 + 0.6 \times (2 - 1) = 1.6$ | Feb peak: $1.15$              | 200    | Low: ₹4,41,600<br/>Mid: ₹6,80,800<br/>High: ₹9,20,000   | ₹10,00,000 (25% of ₹40L)          | **ok**   | None (allocation $\ge$ high)                                                 | `compressed_plan` (warning)<br/>`peak_season` (info)<br/>`special_diet_counters` (info)<br/>`wedding_muhurat_verify` (info)                                |
| **Wedding Stressed** (`weddingStressedFixture`)         | Tier 1 Mid: ₹1,200 – ₹2,500 (Mid: ₹1,850) | $1.0 + 0.6 \times (3 - 1) = 2.2$ | Feb peak: $1.15$              | 300    | Low: ₹9,10,800<br/>Mid: ₹14,04,150<br/>High: ₹18,97,500 | ₹6,25,000 (25% of ₹25L)           | **over** | Max guests: 133<br/>Alternative tier: `budget`<br/>Savings needed: ₹7,79,150 | `compressed_plan` (warning)<br/>`peak_season` (info)<br/>`catering_over` (critical)<br/>`special_diet_counters` (info)<br/>`wedding_muhurat_verify` (info) |
| **Kids Birthday** (`birthdayKidsIndoreFixture`)         | Tier 2 Mid: ₹900 – ₹1,800 (Mid: ₹1,350)   | $0.5$ (Kids multiplier)          | $1.0$ (Non-wedding)           | 40     | Low: ₹18,000<br/>Mid: ₹27,000<br/>High: ₹36,000         | ₹40,000 (30/75 normalized of ₹1L) | **ok**   | None (allocation $\ge$ high)                                                 | `special_diet_counters` (info)                                                                                                                             |
| **Community Festival** (`communityGaneshMumbaiFixture`) | Fixed band: ₹50 – ₹150 (Mid: ₹100)        | $1.0$                            | $1.0$ (Non-wedding)           | 500    | Low: ₹25,000<br/>Mid: ₹50,000<br/>High: ₹75,000         | ₹80,000 (20% of ₹4L)              | **ok**   | None (allocation $\ge$ high)                                                 | `monsoon_outdoor` (warning)<br/>`special_diet_counters` (info)<br/>`community_permissions_verify` (info)                                                   |

### Formula Comparison & Verification

- **Wedding Stressed Calculation**:
  $$\text{Units} = 300 \times 2.2 \times 1.15 = 759$$
  $$\text{Low} = 1200 \times 759 = ₹9,10,800 \quad | \quad \text{Mid} = 1850 \times 759 = ₹14,04,150 \quad | \quad \text{High} = 2500 \times 759 = ₹18,97,500$$
  $$\text{Allocation} = ₹6,25,000 < \text{Mid} \implies \mathbf{status: over}$$
  Matches your hand calculation identically.
- **Kids Birthday Calculation**:
  $$\text{Units} = 40 \times 0.5 \times 1.0 = 20$$
  $$\text{Low} = 900 \times 20 = ₹18,000 \quad | \quad \text{Mid} = 1350 \times 20 = ₹27,000 \quad | \quad \text{High} = 1800 \times 20 = ₹36,000$$
  With venue hosted at home (`venueIncluded: true`), the 25% venue weight drops, normalizing the 30% catering weight over the remaining 75 points:
  $$\text{Allocation} = \left(\frac{30}{75}\right) \times ₹1,00,000 = ₹40,000 \ge \text{High} \implies \mathbf{status: ok}$$
  (At previous ₹60,000 budget, allocation was $₹24,000 < \text{Mid} \implies \text{over}$; at updated ₹1,00,000 budget, allocation is $₹40,000 \ge \text{High} \implies \text{ok}$).
- **Community Festival Calculation**:
  $$\text{Units} = 500 \times 1.0 = 500$$
  $$\text{Low} = 50 \times 500 = ₹25,000 \quad | \quad \text{High} = 150 \times 500 = ₹75,000$$
  $$\text{Allocation} = 20\% \times ₹4,00,000 = ₹80,000 \ge \text{High} \implies \mathbf{status: ok}$$
  Matches your hand calculation identically.

---

## 2. Flags & Replan Transitions

1. **Parameters & Schema Alignment**:
   In `src/domain/rules/flags.ts`, both `catering_over` and `catering_tight` emit with the exact parameter contract:
   ```typescript
   params: {
     allocation: cateringAllocation,
     estimateMid: budget.estimates.catering.mid,
     estimateHigh: budget.estimates.catering.high,
     suggestions: budget.estimates.catering.suggestions,
   }
   ```
2. **Replan Diffing & Root Cause Analysis**:
   - _Previous Behavior_: Previously, the default sample plan started in an `over` status (at ₹25L, 300 guests), so replan tests only observed an already-failed state or delta shifts.
   - _Fix & Transition_: With `weddingDefault` starting in a coherent `ok` status (200 guests, 2 functions, ₹40L, allocation ₹10L vs estimates up to ₹9.2L), running `replan(weddingDefault, { guestCount: 300 })` cleanly shifts status from `ok` to `over`, appends `catering_over` to `diff.flagsAdded`, and emits:
     - `Estimated catering requirement shifted by +₹3,40,400`
     - `New advisory notice(s) raised: catering_over`
     - `Guest count adjusted from 200 to 300 (+100 guests)`
   - Reversing this by reducing guest counts removes `catering_over`, appends to `diff.flagsRemoved`, and records `Resolved advisory notice(s): catering_over`.

---

## 3. Flag Naming: `special_diet_counters`

- Renamed `dietary_mismatch` $\to$ `special_diet_counters` with severity `info`.
- `dietary_mismatch` code, messages, and associated tests were removed.
- Validated message template in `src/domain/config/in/messages.ts`:
  ```typescript
  special_diet_counters: (p: { detail: string }) =>
    `Special dietary requirements specified (${p.detail}). Dedicated preparation counters or labeled buffet sections advised.`,
  ```

---

## 4. Jain / Vegan Consistency Across Event Types

In `src/domain/rules/checklist.ts`, conditional handling treats Jain and Vegan requirements consistently across every event type that has a food vendor (`wedding`, `birthday_kids`, `birthday_adult`, `community_festival`):

1. **Jain (`dietary.jain > 0`)**: Appends a separate checklist item (`jain_kitchen_setup`) with priority `high`, label _"Separate Jain Catering Counter & Dedicated Fryers"_, and note _"Separate Jain counter/kitchen without root vegetables (onion, garlic, potato)."_
2. **Vegan (`dietary.vegan > 0`)**: Locates the food vendor checklist item (`caterer` or `prasad_vendor`) and appends the vegan specification note directly to that item without introducing a redundant standalone vendor row.

### Updated Checklist Item Counts Per Fixture

- **Wedding Default** (`weddingPuneFixture`): **18 items** (16 base + `multi_function_flow` + `jain_kitchen_setup`)
- **Wedding Stressed** (`weddingStressedFixture`): **18 items** (16 base + `multi_function_flow` + `jain_kitchen_setup`)
- **Kids Birthday** (`birthdayKidsIndoreFixture`): **10 items** (9 base + `jain_kitchen_setup`)
- **Community Festival** (`communityGaneshMumbaiFixture`): **14 items** (12 base + `backup_tent` + `jain_kitchen_setup`)

---

## 5. Fixtures Update

Updated in `src/domain/fixtures/profiles.ts`:

- `weddingStressedFixture` (`weddingStressed`): Pune, tier 1, mid, 300 guests, 3 functions, ₹25,00,000, 2027-02-14 (catering `over`).
- `weddingPuneFixture` (`weddingDefault`): Pune, tier 1, mid, 200 guests, 2 functions, ₹40,00,000, 2027-02-14 (catering `ok`).
- `birthdayKidsIndoreFixture` (`birthdayKidsDefault`): Indore, tier 2, mid, 40 guests, ₹1,00,000, 2026-12-15 (catering `ok`).
- `communityGaneshMumbaiFixture` (`communityDefault`): Mumbai, tier 1, budget, 500 guests, ₹4,00,000, 2027-09-14 (catering `ok`).

Unit test in `tests/unit/domain/replan.test.ts` verifies:

```typescript
replan(weddingDefault, { guestCount: 300 });
// -> catering shifts ok -> over
// -> diff.flagsAdded contains 'catering_over'
// -> diff.summaryFacts contains 'Estimated catering requirement shifted by +₹3,40,400'
```

---

## 6. Test Quality & Coverage Metrics

In `vitest.config.ts`, thresholds enforce `lines: 90` and `branches: 80`. All 10 flag codes are tested in both firing and non-firing conditions.

### Vitest v8 Coverage Results (`src/domain/`)

```
------------------|---------|----------|---------|---------|--------------------
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------|---------|----------|---------|---------|--------------------
All files         |   98.80 |    86.68 |  100.00 |   98.80 |
 domain           |  100.00 |    81.25 |  100.00 |  100.00 |
  dates.ts        |  100.00 |    81.25 |  100.00 |  100.00 | 30-32
 domain/config/in |   99.53 |    93.33 |  100.00 |   99.53 |
  data.ts         |  100.00 |   100.00 |  100.00 |  100.00 |
  index.ts        |   94.94 |    80.00 |  100.00 |   94.94 | 104-108
  messages.ts     |  100.00 |   100.00 |  100.00 |  100.00 |
 domain/money     |  100.00 |    94.87 |  100.00 |  100.00 |
  inr.ts          |  100.00 |    94.87 |  100.00 |  100.00 | 20,107
 domain/rules     |   97.45 |    83.58 |  100.00 |   97.45 |
  assumptions.ts  |  100.00 |    83.33 |  100.00 |  100.00 | 90
  budget.ts       |   93.10 |    81.35 |  100.00 |   93.10 | 251-253,290,313
  checklist.ts    |   99.09 |    87.87 |  100.00 |   99.09 | 125
  flags.ts        |  100.00 |    92.00 |  100.00 |  100.00 |
  plan.ts         |  100.00 |   100.00 |  100.00 |  100.00 |
  replan.ts       |  100.00 |    83.33 |  100.00 |  100.00 |
  timeline.ts     |   95.74 |    73.91 |  100.00 |   95.74 | 95-96,100-101
 domain/schemas   |  100.00 |   100.00 |  100.00 |  100.00 |
  profile.ts      |  100.00 |   100.00 |  100.00 |  100.00 |
------------------|---------|----------|---------|---------|--------------------
```

- **`flags.ts` line coverage**: **100%** ($\ge 95\%$ target met)
- **`replan.ts` line coverage**: **100%** ($\ge 95\%$ target met)
- **Global domain branch coverage**: **86.68%** ($\ge 80\%$ target met)
- **Total Unit Tests**: **106 passing tests** across 12 test files.

---

## 7. Documentation & Verification Summary

1. `docs/decisions.md`: Unique ADR log numbering verified:
   - **ADR-001**: Hybrid Rules-Engine + LLM Architecture
   - **ADR-002**: Vercel Single Deployment Target & Server-Only Secret Boundary
   - **ADR-003**: VendorSource Interface with Deterministic Sample Default
   - **ADR-004**: Content Security Policy & Inline Script Management
   - **ADR-005**: Integer Rupee Arithmetic & Largest Remainder Allocation
   - **ADR-006**: Injected "today" Parameter & UTC Date-Only Arithmetic
2. `docs/architecture.md`: Documented rules engine data flow sequence diagram (`profile -> validate -> buildPlan -> replan diff`).
3. `README.md`: Updated Phase 2.1b status and boundaries table.
4. `src/domain/config/in/SOURCES.md`: Thoroughly documented heuristic baseline assumptions.

### Full Pipeline Check Results

```bash
$ pnpm lint         # Passed (0 errors, 0 warnings)
$ pnpm format       # Passed (All matched files use Prettier style)
$ pnpm typecheck    # Passed (0 errors)
$ pnpm test         # Passed (106 unit tests passed)
$ pnpm build        # Passed (Next.js 15 production build compiled in 577ms)
$ pnpm test:e2e     # Passed (6 Playwright tests passed across mobile & desktop with 0 axe violations)
```
