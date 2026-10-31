# Security Policy & Architecture

## Overview

Utsav Planner is designed with a defense-in-depth security model, strictly enforcing the principle that the AI layer is an untrusted creative copywriter, while all financial, scheduling, and mathematical computations are deterministic and verified.

---

## Threat Model & Mitigations

### 1. Prompt Injection & Boundary Overrides

- **Threat**: Malicious user inputs attempting to override system prompts, extract internal configuration, force financial hallucination, or inject harmful instructions via event notes or chat prompts.
- **Mitigations**:
  - **Untrusted Tag Isolation**: User notes are sanitized (`sanitizeUserNotes` in [prompts.ts](file:///Users/arnav/Desktop/event_planner/src/server/ai/prompts.ts)) to strip delimiter look-alikes (`<user_notes>`, markdown backticks), truncated to 1,000 characters, and enclosed in strict XML delimiters `<user_notes>...</user_notes>`.
  - **Structural Prompt Separation**: System instructions are fixed and immutable. User input is never concatenated into the system prompt.
  - **Language-Only Boundary**: Prompt rules explicitly instruct models that they write language only and never invent numbers or dates.
  - **Multi-Stage Output Validation**: Every AI response must pass Zod schema parsing, repair chains, and semantic validators ([validators.ts](file:///Users/arnav/Desktop/event_planner/src/server/ai/validators.ts)).
  - **Numeric Guards**: Output text is scanned; any numbers present must match the input facts. If unauthorized rupee amounts or dates are found, the output is rejected and fails over to deterministic templates.
  - **Dietary Respect Guard**: Menu outputs are cross-checked against dietary keywords ([dietary.ts](file:///Users/arnav/Desktop/event_planner/src/domain/config/in/dietary.ts)); vegetarian menus containing meat/poultry/fish terms or Jain items containing root vegetables are rejected.

### 2. API Key Leakage & Client-Side Secrets

- **Threat**: Exposure of JarvisLabs, Gemini, or Google Places API keys in client JavaScript bundles, network payloads, or git commits.
- **Mitigations**:
  - **Server-Only Isolation**: All provider SDKs (`@google/genai`, `openai`) and environment configurations are isolated using Next.js `import 'server-only'` in [env.ts](file:///Users/arnav/Desktop/event_planner/src/server/env.ts), [gemini.ts](file:///Users/arnav/Desktop/event_planner/src/server/ai/gemini.ts), and [jarvis.ts](file:///Users/arnav/Desktop/event_planner/src/server/ai/jarvis.ts).
  - **Client Bundle Verification**: Production builds are tested via automated static grep sweeps ensuring `JARVISLABS_API_KEY`, `GEMINI_API_KEY`, and `GOOGLE_PLACES_API_KEY` never appear in `.next/static`.
  - **Automated Secret Scanning**: Pre-commit and CI automated sweeps run Gitleaks over the full git history.
  - **Sanitized Client Errors**: Downstream AI errors or stack traces are never exposed to the client. The client receives standardized, sanitized error codes (`RATE_LIMIT_EXCEEDED`, `AI_UPSTREAM_ERROR`, `ALL_PROVIDERS_UNAVAILABLE`).

### 3. Abuse, Quota Drain & Denial of Service (DoS)

- **Threat**: Malicious scraping, repeated LLM generation requests draining provider quotas, or oversize JSON payloads causing memory exhaustion.
- **Mitigations**:
  - **Dual-Tier & Daily Rate Limiting**: In-memory token bucket rate limiting ([rateLimit.ts](file:///Users/arnav/Desktop/event_planner/src/server/security/rateLimit.ts)) applies a 10 req/min limit on AI endpoints (`/api/ai/*`), a daily cap via `LLM_DAILY_LIMIT` (default 60 requests/client/day), and 60 req/min on standard endpoints (`/api/*`), returning `429 Too Many Requests` with RFC-compliant `Retry-After` headers. Client IP resolution strictly prioritizes Vercel's edge proxy header `x-vercel-forwarded-for`, followed by the first hop of `x-forwarded-for`, and finally `x-real-ip`.
  - **Circuit Breaker**: Provider circuit breakers ([circuitBreaker.ts](file:///Users/arnav/Desktop/event_planner/src/server/security/circuitBreaker.ts)) trip on consecutive upstream failures or HTTP 429 quota errors. When Gemini returns 429 quota exhaustion with `retryDelay`, the breaker opens for that duration (capped at 5 minutes for per-minute quotas, and 30 minutes for daily quotas), preventing futile upstream calls.
  - **Payload Size Guards**: API route helpers ([apiHelper.ts](file:///Users/arnav/Desktop/event_planner/src/server/apiHelper.ts)) reject any incoming JSON request exceeding 100 KB with HTTP 413.
  - **Strict Request Timeouts & Deadlines**: Every AI call enforces an upstream timeout (default 8s) and a hard end-to-end deadline (`AI_TOTAL_DEADLINE_MS=15000`), terminating slow responses before Vercel gateway timeouts.

### 4. Data Privacy & Storage Policy

- **What is transmitted to AI Providers (JarvisLabs & Gemini)**:
  - Event metadata: `eventType`, `cityName`, `cityTier`, `budgetTier`, `venueType`, and `guestCount`.
  - Dietary ratios: percentages for `veg`, `nonVeg`, and `jain`.
  - Plan diff facts: deterministic summary delta strings and shifted milestone titles (for diff narration).
  - Free-text notes / Chat messages: the user's aesthetic notes or chat prompts. The UI provides a real-time, non-blocking privacy alert in Step 4 if phone numbers or email patterns are detected. On the server, `sanitizeUserNotes` automatically redacts phone numbers and email addresses to `[removed]` before forwarding user notes to external LLM providers.
- **Server-Side Data Storage**:
  - **Zero Server-Side Storage**: Utsav Planner maintains **no server-side database**, no session cookies, and stores zero personal data on its servers. All event plans, overrides, and chat histories reside entirely in the user's browser `localStorage`.
  - **Ephemeral Server State**: In-memory caches and rate-limit buckets store only cryptographic hashes (`sha256`) of prompt inputs and client IP hashes, with automatic TTL eviction.

---

## Security Headers

The production Next.js configuration ([next.config.ts](file:///Users/arnav/Desktop/event_planner/next.config.ts)) emits strict HTTP response headers across all routes:

- **Content-Security-Policy (CSP)**: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=()`
- **Strict-Transport-Security (HSTS)**: `max-age=63072000; includeSubDomains`
- **X-Powered-By**: Disabled

---

## Production Deployment Limitations & Upgrade Path

- **Serverless In-Memory Rate Limiting**: In multi-instance or serverless environments (e.g., Vercel Serverless Functions), the built-in in-memory token bucket operates per container instance.
- **Recommended Production Upgrade**: For high-traffic production deployments with horizontal autoscaling, replace the in-memory store in [rateLimit.ts](file:///Users/arnav/Desktop/event_planner/src/server/security/rateLimit.ts) with **Upstash Redis** (`@upstash/ratelimit` and `@upstash/redis`), enabling globally synchronized sliding-window rate limiting across all edge and serverless nodes.

---

## Reporting Vulnerabilities

If you discover a security vulnerability within Utsav Planner, please report it privately via GitHub Security Advisories or contact the maintainers directly.
