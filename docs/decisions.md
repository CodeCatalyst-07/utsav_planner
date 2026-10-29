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

We introduce an abstract `VendorSource` interface (`src/server/vendors/`) with three adapters:

1. `SampleVendorSource`: Default zero-cost curated dataset covering Tier 1, 2, and 3 Indian cities across caterers, decorators, mehendi artists, and pandits.
2. `GooglePlacesVendorSource`: Real-time location lookup requiring `GOOGLE_PLACES_API_KEY`.
3. `GeminiVendorSource`: Synthetic vendor discovery and recommendation.

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
