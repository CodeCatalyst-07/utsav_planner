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
        Schemas["Zod Schemas (EventProfile, ProfilePatch)"]
        Rules["Rules Engines (Budget, Timeline, Checklists, Flags, Assumptions)"]
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

---

## Domain Data Flow: `profile -> validate -> buildPlan -> replan diff`

The Rules Engine (`src/domain/`) operates as a completely deterministic, side-effect-free pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor User as User Input / Patch
    participant Validator as validateProfile(input, today)
    participant PlanBuilder as buildPlan(profile, today, pack)
    participant BudgetEngine as computeBudget()
    participant TimelineEngine as computeTimeline()
    participant ChecklistEngine as computeChecklist()
    participant FlagsEngine as computeFlags()
    participant ReplanEngine as replan(currentPlan, patch, today)

    User->>Validator: Raw Profile Data + today ('YYYY-MM-DD')
    Note over Validator: Strips control chars, checks eventDate > today,<br/>validates dietary sum <= guestCount
    Validator-->>PlanBuilder: Validated EventProfile

    rect rgb(255, 248, 240)
        Note over PlanBuilder: Composition Pipeline (Pure TypeScript)
        PlanBuilder->>BudgetEngine: allocateLargestRemainder() + Catering estimate
        BudgetEngine-->>PlanBuilder: BudgetResult (sum == total, 0 unallocated)
        PlanBuilder->>TimelineEngine: Standard vs Compressed scaling
        TimelineEngine-->>PlanBuilder: TimelineResult (monotonic dates in [today, eventDate-1])
        PlanBuilder->>ChecklistEngine: Base templates + Declarative conditional items
        ChecklistEngine-->>PlanBuilder: ChecklistResult (due dates clamped to today)
        PlanBuilder->>FlagsEngine: Advisory & Warning synthesis
        FlagsEngine-->>PlanBuilder: Flag[]
    end

    PlanBuilder-->>User: BasePlan (Immutable plan snapshot)

    opt Re-planning Phase
        User->>ReplanEngine: currentPlan + ProfilePatch + today
        ReplanEngine->>Validator: Validate merged state
        ReplanEngine->>PlanBuilder: Build new BasePlan
        ReplanEngine-->>User: ReplanResult { plan, diff: { budgetLines, totalDelta, milestonesShifted, summaryFacts } }
    end
```

---

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
   - Guarded by ESLint `no-restricted-imports` prohibiting imports of `next`, `react`, `server-only`, or `src/server`.
   - Injected explicit `today: string` ('YYYY-MM-DD'); zero reliance on `Date.now()`.
   - Integer rupee calculations via Largest Remainder algorithm (`allocateLargestRemainder`).
   - Deterministic calculations for Indian celebrations.

4. **External Services (`src/server/llm/`, `src/server/vendors/`, `src/server/google/`)**:
   - Unified provider interfaces with swappable adapters.
   - Default fallbacks (`SampleVendorSource`) allow running offline without paid external services.
