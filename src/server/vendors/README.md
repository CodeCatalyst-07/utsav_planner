# Server Vendor Adapters (`src/server/vendors`)

Contains the unified `VendorSource` interface and concrete implementations:

- `SampleVendorSource`: Deterministic curated Indian vendor dataset (default; requires zero API keys or external billing).
- `GooglePlacesVendorSource`: Google Places API (New) adapter for real location-based vendor lookup.
- `GeminiVendorSource`: Synthetic vendor discovery and evaluation via LLM.

### Invariants:

- All external HTTP calls and caching strategies are encapsulated here.
