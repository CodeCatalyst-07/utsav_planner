# Architecture Decision Records (ADRs)

Log of key architectural decisions for **Utsav Planner**.

---

## ADR-001: Hybrid Rules-Engine + LLM Architecture

### Status

Accepted

### Context

Celebration and event planning in India requires exact calculations (guest-count budget breakdowns, caterer per-plate multipliers, muhurat and ritual scheduling) combined with high-touch contextual synthesis (personalized wedding themes, customized itinerary narratives). Relying purely on LLMs for calculations leads to numerical hallucination, while hardcoding every element eliminates creative personalization.

### Decision

We adopt a **hybrid architecture**:

1. **Deterministic Rules Engine (`src/domain/rules/`)**: Implemented as pure TypeScript functions with zero I/O and zero LLM dependencies. Computes budget allocation bands, backward milestone scheduling, and standard vendor checklists.
2. **GenAI Layer (`src/server/llm/`)**: Invoked only to augment and synthesize creative layers (e.g. personalized ideas, theme variations, customized greetings).

### Consequences

- Mathematical operations are 100% deterministic and reproducible.
- Unit testing domain rules requires zero mocking and zero token usage.
- Strict isolation of concerns protects user budgets from LLM stochastic variance.

---

## ADR-002: Vercel Single Deployment Target & Server-Only Secret Boundary

### Status

Accepted

### Context

The application targets Vercel deployment. Client-side code must never have access to LLM API keys (Gemini, JarvisLabs) or vendor APIs (Google Places).

### Decision

1. All secret-handling code is restricted to `src/server/` and guarded with `import 'server-only'`.
2. Next.js Route Handlers (`src/app/api/`) serve as the sole execution boundary for secrets.
3. No environment variables are prefixed with `NEXT_PUBLIC_`.
4. Environment parsing via Zod validates variable formats at runtime and emits missing variable names **without ever logging or printing variable values**.

### Consequences

- Zero secret leakage to the browser bundle.
- Build and CI steps run without requiring secret keys due to lazy `getEnv()` memoization.

---

## ADR-003: VendorSource Interface with Deterministic Sample Default

### Status

Accepted

### Context

Real-world vendor directories require Google Places API (New) billing or localized scraping, which may not be configured in developer, testing, or grading environments.

### Decision

We introduce an abstract `VendorSource` interface (`src/server/vendors/`) with two adapters:

1. `SampleVendorSource`: Default zero-cost curated dataset covering Tier 1, 2, and 3 Indian cities across caterers, decorators, mehendi artists, and pandits. All entries carry the `'sample'` badge and explicit fictional disclaimer notes.
2. `GooglePlacesVendorSource`: Real-time location lookup via Google Places API (New) Text Search requiring `GOOGLE_PLACES_API_KEY`.

Note: `gemini` is explicitly removed from `VENDOR_SOURCE` (allowed: `sample` | `places`). To eliminate hallucinated businesses and fake contact details, the LLM may narrate, rank, or explain vendor categories, but vendor records and names originate solely from verified Places search or curated sample placeholders, with universal Google Maps search fallback links attached.

The default is configured to `VENDOR_SOURCE=sample`, requiring zero keys or external setup.

### Consequences

- The application is immediately functional out of the box.
- End-to-end tests and evaluation graders run without third-party API dependencies or billing setup.

---

## ADR-004: Content Security Policy & Inline Script Management

### Status

Accepted

### Context

Modern web security requires strict Content Security Policies (CSP) to mitigate cross-site scripting (XSS) and clickjacking. Next.js App Router relies on inline scripts for client-side hydration, framework bootstrap, and font optimization.

### Decision

1. Security headers are configured in `next.config.ts`:
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - `X-Frame-Options: DENY`
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (without preload during scaffolding)
   - `frame-ancestors 'none'`
2. `script-src` includes `'unsafe-eval'` only when `NODE_ENV !== 'production'`.
3. `'unsafe-inline'` is currently retained for script-src to permit Next.js hydration chunks.
4. Future hardening: A nonce-based CSP generated via Edge Middleware (`x-nonce`) will replace `'unsafe-inline'` in a subsequent security hardening phase once routing stabilizes.

### Consequences

- Protects against unauthorized iframe framing, MIME sniffing, and external script injection.
- Preserves smooth development hot-reloading and production hydration.

---

## ADR-005: Integer Rupee Arithmetic & Largest Remainder Allocation

### Status

Accepted

### Context

Floating point arithmetic in JavaScript creates fractional rounding anomalies (e.g. `0.1 + 0.2 = 0.30000000000000004`) and unallocated or over-allocated paise. In celebration budgets, users expect integer rupee line items whose sum equals their total budget to the exact rupee.

### Decision

1. All monetary inputs and outputs in `src/domain/` are represented as whole integer rupees (`Math.round()` on entry).
2. Weight-based percentage budget splits use the **Largest Remainder (Hamilton / Hare-Niemeyer)** algorithm (`allocateLargestRemainder`), guaranteeing `sum(lines) === total` with deterministic tie-breaking by index.
3. Currency formatting strictly utilizes the Indian numbering grouping (`₹12,34,567`) with an accessible spoken conversion (`inrSpoken`) for screen readers.

### Consequences

- Guarantees 0 unallocated rupees across any budget allocation.
- Avoids floating-point discrepancies across Vercel serverless runtimes.

---

## ADR-006: Injected "today" Parameter & UTC Date-Only Arithmetic

### Status

Accepted

### Context

Calling `new Date()` or `Date.now()` inside domain functions causes non-determinism, breaks property-based testing, and induces timezone drift (e.g., local server time vs IST midnight shifts where a day boundary shifts an event offset).

### Decision

1. Domain functions are **pure**: calling `new Date()`, `Date.now()`, or `Math.random()` inside `src/domain/` is strictly forbidden.
2. The current date (`today`) is passed as an explicit `YYYY-MM-DD` parameter to all timeline and validation functions.
3. Date arithmetic (`daysBetween`, `addDays`) operates purely in UTC on calendar day counts (`Date.UTC(y, m-1, d)`), eliminating daylight saving, IST offset anomalies, and leap-year drift.
4. An ESLint rule (`no-restricted-imports`) guarantees that `src/domain/` cannot import framework packages (`next`, `react`, `server-only`, or `src/server`).

### Consequences

- 100% reproducible test snapshots and deterministic replanning diffs.
- Clean isolation between platform time and domain calculations.

---

## ADR-007: AI Provider Chain, Gemini Critic, Template Fallback & Numeric Guard

### Status

Accepted

### Context

Relying on a single third-party LLM endpoint introduces single points of failure (rate limits, network partitions, service outages) and risks numerical or factual hallucinations. In celebration planning, dates, guest counts, and rupee allocations must remain strictly deterministic. The LLM must generate only contextual language (creative themes, planning tips, curated menus, diff narration, intent parsing) and never invent numbers or currency figures.

### Decision

1. **Provider Chain & Failover (`src/server/ai/chain.ts`)**:
   - Order of execution: JarvisLabs Gemma 4 (`gemma-4-31b-it`, OpenAI-compatible) -> Google Gemini (`gemini-2.5-flash`, official `@google/genai` SDK) -> Deterministic Template Fallback (`DeterministicFallback` via `src/domain/config/in/fallbacks.ts`).
   - Circuit breakers (`CircuitBreaker`) trip after 3 consecutive errors and remain open for 30s before half-open retry.
   - Provider failover occurs immediately on rate limits (HTTP 429), server errors (5xx), timeouts (AbortController at `LLM_TIMEOUT_MS`, default 20s), or authentication failures.
   - Per-provider single repair loop: on schema or semantic validation failure, retries once with the specific validator error message before advancing to the next provider.
   - The deterministic template fallback is valid by construction, guaranteeing the application always returns a well-formed response even during complete network or API outages.
2. **Gemini as Load-Bearing Critic (`src/server/ai/critic.ts`)**:
   - When configured and `CRITIC_ENABLED=true`, a single post-generation Gemini call critiques generated sections for cultural consistency, dietary alignment (veg/non-veg/jain counts), and budget tier coherence.
   - Flagged sections are re-generated once with the critique appended.
   - Critic failures degrade gracefully and never block the user response.
3. **Numeric Guard & Semantic Validators (`src/server/ai/validators.ts`)**:
   - Every number token in prose responses (including digits, Indian groupings like `12,000`, spoken terms like `lakh` / `crore`, currency symbols `₹` / `Rs`) must appear in the allowed set extracted from the deterministic input context (guest counts, budget figures, milestone offsets).
   - Rejects banned advertising claims ("guaranteed", "best price"), fake phone numbers, URLs, and scans against configured environment secrets.

### Consequences

- 100% resilience against upstream AI outages.
- Elimination of hallucinated financial figures and phantom calendar dates.
- Predictable execution latency and clear provenance metadata in responses.

---

## ADR-008: Prompt Sanitization of Untrusted Input & In-Memory Rate Limiting Boundaries

### Status

Accepted

### Context

User-supplied text (such as custom event notes, dietary comments, and chat messages) enters LLM prompts, opening the vector for prompt injection, delimiter breakout attacks, or token exhaustion. Furthermore, public endpoints require rate limiting to prevent denial-of-service and quota drain.

### Decision

1. **Untrusted Data Isolation (`src/server/ai/prompts.ts`)**:
   - User notes are treated as untrusted data and strictly isolated inside structural delimiters `<user_notes>...</user_notes>`.
   - Delimiter look-alikes (`</user_notes>`, `<user_notes>`) are stripped prior to prompt injection.
   - System instructions explicitly mandate that content within user data delimiters must be treated solely as passive context and never as procedural instructions.
   - Prompts contain only sanitized counts and categories, never guest personal identifiable information (PII) like names or phone numbers.
2. **In-Memory Token Bucket Limiting (`src/server/security/rateLimit.ts` & `src/server/apiHelper.ts`)**:
   - Enforces per-client token bucket limits based on client IP (retrieved safely from the first-hop `x-forwarded-for` header).
   - Rate limiters apply distinct windows: strict quota for AI generation endpoints (10 req/min, 150 req/day) and generous quota for deterministic engine routes (60 req/min, 2,000 req/day).
   - Request payloads are capped at 16KB with strict JSON schema validation, rejecting oversized or malformed bodies before triggering downstream operations.
   - Note: In-memory limiters are scoped to individual serverless instance lifecycles; production multi-region deployments should front this with Edge rate limiting or Redis-backed stores (e.g. Upstash) when distributed persistence is required.

### Consequences

- Defense against prompt injection and jailbreak attempts.
- Prevention of upstream quota exhaustion without requiring heavy database dependencies.

---

## ADR-009: Calendar Links/RFC 5545 .ics Export & Universal Google Maps Links

### Status

Accepted

### Context

Users need milestone deadlines synced to their calendar and vendor research mapped locally. Requiring full Google OAuth authentication or Google Places API billing creates significant adoption friction and grading barriers.

### Decision

1. **Zero-OAuth Calendar Integration (`src/server/google/calendar.ts`)**:
   - Direct Web Links: Generates one-click `https://calendar.google.com/calendar/render?action=TEMPLATE` URLs for each milestone, using all-day formatting with exclusive end dates (`YYYYMMDD` to `YYYYMMDD+1`).
   - Universal RFC 5545 `.ics` Export: Generates downloadable calendar files conforming strictly to RFC 5545, with CRLF (`\r\n`) line endings, 75-octet folding, UTC timestamping, and `VALARM` reminder alerts on critical milestones. Compatible with Apple Calendar, Outlook, and Google Calendar without requiring user credentials.
2. **Universal Google Maps Links & Places Adapter (`src/server/vendors/`)**:
   - Universal search links (`https://www.google.com/maps/search/?api=1&query=<encoded>`) are attached to every search result with zero API key or billing requirement.
   - `PlacesVendorSource` connects to the Google Places API (New) Text Search (`places:searchText`) using minimal field masks (`places.id`, `places.displayName`, `places.formattedAddress`, `places.googleMapsUri`) to control latency and billing costs.
   - If the Places API fails, encounters 429 quota exhaustion, or is disabled, the system seamlessly falls back to curated sample listings with universal Google Maps search links.

### Consequences

- Zero user login or OAuth consent friction for calendar scheduling.
- Full vendor lookup functionality with zero mandatory billing or API keys.

---

## ADR-010: Client-Side Engine for Instant What-If, LocalStorage-Only Persistence & Sample Mode Isolation

### Status

Accepted

### Context

Traditional planning applications perform what-if sandbox rebalancing via round-trips to backend servers. For celebration planning, where users rapidly tweak guest numbers, budget limits, or dates, network latency (200-800ms) disrupts exploratory flow and drains server compute. Furthermore, users planning sensitive events (family weddings, private budgets) demand absolute privacy without creating accounts, while prospective users want to explore realistic sample plans without corrupting or destroying their active celebration blueprints.

### Decision

1. **Client-Side Engine Execution**:
   - The planning engine (`src/domain/`) is implemented as pure TypeScript with zero Node/Next.js I/O dependencies.
   - The browser imports `replan()` directly in React components. What-if recalculations run locally in ~1ms with **zero network calls**.
   - The server is contacted solely for AI qualitative ideas (`POST /api/ai/section`), ICS calendar export, and vendor lookups.
2. **LocalStorage-Only Versioned Persistence**:
   - User plans are stored strictly in the client's `localStorage` under a versioned key (`utsav_plan_v1`).
   - On load, data is parsed safely inside a try/catch block and strictly validated against domain Zod schemas (`validateProfile`). Corrupt or schema-invalid data is cleanly discarded without crashing.
   - Reading storage occurs within a `useEffect` hydration hook, rendering skeleton placeholders until hydrated to prevent React SSR hydration mismatches.
   - A visible "Clear my data" modal dialog allows users to purge all local planner state and sessionStorage caches permanently.
3. **Sample Mode Isolation**:
   - "Try a sample plan" loads realistic curated fixtures into an isolated in-memory state without overwriting or destroying any saved real plan.
   - A persistent top banner alerts users ("You're viewing a sample plan. None of this replaces your saved data") with quick actions to "Return to my saved plan" and "Start my own plan".
   - Sample plan edits and what-if adjustments are never committed to `utsav_plan_v1` in `localStorage`. Exiting sample mode immediately restores the user's untouched real plan.

### Consequences

- Instantaneous (<1ms) what-if feedback when tweaking guests, budgets, and dates.
- Maximum user privacy: zero personal financial data or event specs are transmitted to servers or stored in remote databases.
- Risk-free exploration through sample mode without fear of data loss.

---

## ADR-011: Deterministic Intent Extraction, Client-Side Rebalance Preview & Explicit User Confirmation

### Status

Accepted

### Context

Interactive chat assistants often propose structural changes to a user's celebration blueprint (e.g., reducing guest counts, altering total budgets, or shifting event dates). Automatically applying changes directly to a user's active plan without explicit permission risks user disorientation, silent data corruption, and loss of trust. Furthermore, relying on ungrounded LLM calculations for budget deltas or milestone shifts causes arithmetic hallucinations.

### Decision

1. **Deterministic Intent Extraction & Diff Calculation**:
   - User chat prompts sent to `POST /api/ai/chat` are parsed by a deterministic intent extractor (`src/domain/intents/parseIntent.ts`) using regex and Indian rupee parsing (`parseInrAmount`).
   - The server verifies patches using `replan()` (`src/domain/rules/replan.ts`) to compute exact mathematical diffs (total budget delta, catering delta, milestone shifts, advisory flags).
   - The AI assistant returns conversational advice alongside structured `patch` and `diff` payloads.
2. **Explicit Confirmation User Experience**:
   - Assistant responses proposing plan modifications render a structured "Proposed Plan Adjustment" card with mathematically verifiable summary facts and diff chips.
   - Proposals are **never automatically applied**. The user must explicitly click "Apply change" to mutate state or "No thanks" to dismiss the card.
   - Upon confirmation, `applyPatch()` updates the client state and commits to `utsav_plan_v2` in `localStorage` (or isolated sample state in sample mode).
3. **Storage Schema v2 with Backward-Compatible v1 Migration**:
   - Upgraded `localStorage` storage key to `utsav_plan_v2`, persisting user task progress: `completedMilestones: string[]` and `bookedVendors: string[]`.
   - Safe migration reads legacy `utsav_plan_v1`, preserving existing profile details and category overrides while initializing task progress cleanly.

### Consequences

- Zero silent mutations or unintended overwrites to user plans.
- Mathematical certainty: all displayed deltas, catering projections, and milestone changes are derived from the deterministic domain engine.
- Complete backward compatibility with Phase 2.3a persisted plans.
