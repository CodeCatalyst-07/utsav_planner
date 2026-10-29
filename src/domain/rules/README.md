# Domain Rules (`src/domain/rules`)

Pure deterministic business rules engines:

- Budget splitting algorithms based on event type and guest tiers
- Timeline milestone calculation backwards from event date
- Vendor checklist generator
- Replan / reallocation engine

### Invariants:

- **Zero I/O**: Pure functions only (`(input, config) => output`).
- **Zero Framework Imports**: No UI or server dependencies.
- **Deterministic**: Given identical inputs, always yields identical outputs.
