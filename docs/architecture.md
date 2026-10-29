# System Architecture (`docs/architecture.md`)

## Overview

**Utsav Planner** is structured following Clean Architecture principles adapted for the Next.js App Router and serverless deployment on Vercel.

```mermaid
graph TD
    subgraph Browser ["Client Layer (Browser)"]
        UI["Accessible Shell UI (Next.js App Router)"]
        Nav["Route Navigation (/plan, /plan/budget, etc.)"]
        Axe["Accessibility Engine (WCAG AAA/AA)"]
    end

    subgraph API ["Execution & Security Boundary (Vercel Route Handlers)"]
        HealthAPI["/api/health"]
        PlanAPI["/api/plan (Future)"]
        RateLimiter["Rate Limiter (RATE_LIMIT_PER_MIN)"]
        EnvValidation["Lazy getEnv() Zod Validation"]
    end

    subgraph Domain ["Pure Domain Layer (Zero I/O, Zero Framework Imports)"]
        Schemas["Zod Schemas (EventProfile, Plan)"]
        Rules["Rules Engines (Budget, Timeline, Checklists)"]
        LocalePack["India Locale Pack (src/domain/config/in)"]
    end

    subgraph ServerIO ["Server I/O & External Adapters (server-only)"]
        LLM["LLMProvider (Gemini / JarvisLabs)"]
        Vendors["VendorSource (Sample / Places / Gemini)"]
        GoogleSync["Google Calendar / Places Helpers"]
    end

    UI --> API
    API --> EnvValidation
    API --> RateLimiter
    API --> Domain
    API --> ServerIO
    ServerIO --> Domain
```

## Architectural Layers

1. **Client / UI (`src/app/`, `src/components/`)**:
   - Server and Client components utilizing semantic HTML5 landmarks (`header`, `nav`, `main#main-content`, `footer`).
   - Single `<h1>` per view, visible high-contrast focus rings, touch targets ≥ 44px.
   - Warm editorial design system with strict color token isolation.

2. **Server Boundaries (`src/app/api/`, `src/server/`)**:
   - Sealed by `import 'server-only'`.
   - Never leaks secret keys or exposes unredacted error messages.
   - Route handlers validate inbound requests against Domain schemas before dispatching to services.

3. **Pure Domain (`src/domain/`)**:
   - Zero side-effects, zero network calls, zero UI imports.
   - Deterministic calculations for Indian celebrations.

4. **External Services (`src/server/llm/`, `src/server/vendors/`, `src/server/google/`)**:
   - Unified provider interfaces with swappable adapters.
   - Default fallbacks (`SampleVendorSource`) allow running offline without paid external services.
