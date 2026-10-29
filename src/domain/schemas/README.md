# Domain Schemas (`src/domain/schemas`)

Pure domain schemas defined using Zod (e.g. `EventProfile`, `Plan`, `BudgetBreakdown`, `TimelineItem`, `VendorChecklist`).

### Invariants:

- **Zero I/O**: Schemas are purely declarative and synchronous.
- **Zero Framework Imports**: No Next.js or React dependencies.
- **Strict Validation**: All external inputs are parsed through these schemas before reaching domain rules.
