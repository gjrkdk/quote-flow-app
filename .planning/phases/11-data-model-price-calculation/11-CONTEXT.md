# Phase 11: Data Model & Price Calculation Foundation - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Database schema and calculation logic for option groups with price modifiers. Option groups are reusable sets of choices (e.g. "Glass type", "Coating") that merchants assign to products. Each choice carries a price modifier (fixed or percentage) applied to the base matrix price. Admin UI, API extension, and widget integration are separate phases (12-14).

</domain>

<decisions>
## Implementation Decisions

### Option group structure
- Single-select only — each group is pick-one (dropdown/radio), no multi-select
- Per-group required/optional setting — merchant marks each group as required or optional
- Optional groups support a merchant-set default choice (pre-selected in widget)
- Reasonable cap on choices per group (e.g. 20) to prevent abuse
- Required groups must have a selection before checkout; optional groups can be left blank

### Modifier behavior
- One modifier type per choice — either fixed amount ($5.00) OR percentage (+10%), not both
- Negative modifiers allowed — choices can reduce the price (e.g. "Economy glass: -15%")
- Floor at $0.00 — total price can never go below zero, silently capped
- Zero-cost options show $0.00 consistently (not "Included" or special label)

### Product assignment rules
- Option groups are optional on products — products work without any groups (full backward compatibility)
- Reasonable cap on groups per product (e.g. 5)
- Groups are shared/reusable across products
- Editing a shared group shows a warning ("Used by N products") then applies everywhere if confirmed
- Display order is alphabetical — no manual reordering needed

### Calculation rules
- Round up (ceiling) for fractional cents — consistent with existing matrix round-up logic
- Non-compounding — all percentage modifiers calculate from base matrix price independently
- Fixed modifiers add/subtract directly to the total
- Calculation order: base price from matrix → apply all modifiers from base → sum → floor at $0.00
- Use store's Shopify currency — no separate currency configuration
- API returns price breakdown: base price, each modifier with its amount, and final total

### Claude's Discretion
- Database table/column naming conventions
- Index strategy for foreign keys
- Prisma schema design patterns
- Validation error message wording
- Test data fixtures and seed structure

</decisions>

<specifics>
## Specific Ideas

- Integer (cents) arithmetic for all calculations — already decided in v1.2 requirements (avoid floating-point)
- Percentage modifiers calculated from base matrix price, non-compounding — already decided in v1.2 requirements
- Price breakdown in API response enables transparent pricing in the widget (Phase 14)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-data-model-price-calculation*
*Context gathered: 2026-02-09*
