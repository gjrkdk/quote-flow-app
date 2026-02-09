# Requirements: Shopify Price Matrix App (QuoteFlow)

**Defined:** 2026-02-09
**Core Value:** Merchants can offer custom-dimension pricing on their headless Shopify storefronts without building their own pricing infrastructure

## v1.2 Requirements

Requirements for milestone v1.2: Option Groups & App Store. Each maps to roadmap phases.

### Option Groups

- [ ] **OPT-01**: Merchant can create reusable option groups with a name (e.g. "Glass Type", "Edge Finish")
- [ ] **OPT-02**: Merchant can add option values to a group with a label and a price modifier (fixed amount or percentage)
- [ ] **OPT-03**: Merchant can edit and delete option groups and their values
- [ ] **OPT-04**: Merchant can assign multiple option groups to a product and control display order
- [ ] **OPT-05**: Merchant can share an option group across multiple products

### Pricing

- [ ] **PRICE-01**: Option modifiers (fixed or percentage) are added to the base matrix price
- [ ] **PRICE-02**: Percentage modifiers are calculated from the base matrix price (non-compounding)
- [ ] **PRICE-03**: Multiple option group modifiers stack additively on the base price
- [ ] **PRICE-04**: Price calculations use integer (cents) arithmetic to avoid floating-point errors

### API

- [ ] **API-01**: REST API accepts option selections alongside dimensions and returns the modified total price
- [ ] **API-02**: REST API validates that option selections match the product's assigned option groups
- [ ] **API-03**: Draft Orders include selected options as line item metadata for merchant visibility
- [ ] **API-04**: Existing API calls work without options (backward compatible)

### Widget

- [ ] **WIDGET-01**: Widget renders dropdown for each option group assigned to the product
- [ ] **WIDGET-02**: Widget updates price live as customer selects options
- [ ] **WIDGET-03**: Widget shows price modifier next to each option value (e.g. "+$15.00", "+20%")
- [ ] **WIDGET-04**: Widget works correctly with products that have no option groups (backward compatible)

### App Store

- [ ] **STORE-01**: Internal Shopify API calls migrated from REST to GraphQL (mandatory for submission)
- [ ] **STORE-02**: App listing complete with icon, screenshots (1600x900px), and description
- [ ] **STORE-03**: Test credentials provided for reviewers (working demo store)
- [ ] **STORE-04**: App submitted to Shopify App Store for review

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Option Group Enhancements

- **OPT-06**: Merchant can use pre-built option group templates for common use cases
- **OPT-07**: Merchant can drag-and-drop reorder option values within a group
- **OPT-08**: Conditional option display — show/hide groups based on other selections

### Deferred (from v1.0)

- **MATRIX-08**: Duplicate matrix
- **MATRIX-09**: Export matrices to CSV
- **PRICE-05**: Price per unit display
- **ORDER-02**: Dimension metadata as line item properties
- **ORDER-03**: Invoice URL for customer payment
- **WIDGET-06**: Preset dimension quick-select
- **WIDGET-07**: Multiple unit support
- **WIDGET-08**: Custom dimension labels
- **PLAT-02**: Visual size preview

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Conditional option logic | Complexity explosion, hard to debug — defer to v2+ |
| Option inventory tracking | Infinite combinations break Shopify model |
| Compounding percentages | Confusing for merchants, unpredictable pricing |
| Formula-based option pricing | Too complex, merchants make errors |
| Image swatches for options | Asset management burden, loading performance |
| Multi-select option groups | Pricing ambiguity (additive? maximum?) |
| Option-specific discounts | Combinatorial complexity |
| Option groups per variant | Data model complexity — use separate products |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPT-01 | — | Pending |
| OPT-02 | — | Pending |
| OPT-03 | — | Pending |
| OPT-04 | — | Pending |
| OPT-05 | — | Pending |
| PRICE-01 | — | Pending |
| PRICE-02 | — | Pending |
| PRICE-03 | — | Pending |
| PRICE-04 | — | Pending |
| API-01 | — | Pending |
| API-02 | — | Pending |
| API-03 | — | Pending |
| API-04 | — | Pending |
| WIDGET-01 | — | Pending |
| WIDGET-02 | — | Pending |
| WIDGET-03 | — | Pending |
| WIDGET-04 | — | Pending |
| STORE-01 | — | Pending |
| STORE-02 | — | Pending |
| STORE-03 | — | Pending |
| STORE-04 | — | Pending |

**Coverage:**
- v1.2 requirements: 21 total
- Mapped to phases: 0
- Unmapped: 21 (pending roadmap creation)

---
*Requirements defined: 2026-02-09*
*Last updated: 2026-02-09 after initial definition*
