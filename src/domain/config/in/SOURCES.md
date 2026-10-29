# India Locale Pack Data Sources (`src/domain/config/in/SOURCES.md`)

## Heuristic Baseline Sources

All monetary values, per-plate bands, category split percentages, lead times, and vendor checklists included in `src/domain/config/in/data.ts` are **blog-derived heuristic placeholders**. They are intended to provide realistic baseline parameters for planning algorithms and are **not commercial quotes or guaranteed prices**.

### 1. Per-Plate Catering Bands & Budget Splits

- Derived from aggregated surveys and public planning guides across Indian wedding portals (WedMeGood, WeddingWire India, ShaadiSaga, EventFAQs) spanning Tier 1 (Mumbai, Delhi NCR, Bengaluru), Tier 2 (Pune, Jaipur, Ahmedabad, Chandigarh), and Tier 3 cities (2023–2025 heuristics).
- Per-plate catering costs reflect standard banquet and outdoor caterer offerings ranging from vegetarian spreads to multi-cuisine luxury banquets.

### 2. Seasonality Adjustments

- **Peak Season (November–February)**: Aligns with the primary North/West Indian wedding season (Tulsi Vivah to Maha Shivratri), where venue and artist demand spikes by an estimated 15–20%.
- **Monsoon Precautions (June–September)**: Aligns with the South-West monsoon season in Maharashtra, Karnataka, Goa, and coastal states where outdoor lawn celebrations require waterproof hangars or indoor backups.

### 3. Milestone Offsets & Lead Times

- Standard lead times reflect common booking windows reported by event organizers:
  - Wedding: 6 to 14 months (muhurat dates, high-demand venues, photographers).
  - Milestone Birthday: 1 to 3 months.
  - Community Festival: 2 to 3 months (pandal construction, idol sculpting, municipal police permissions).

### Invariants:

- All figures carry `source: 'assumption'`.
- All values are user-configurable via overrides or re-planning patches.
- The platform never asserts religious authority (muhurats must be confirmed with priests) or legal authority (municipal permits must be verified locally).
