# Phase 3: Draft Orders Integration - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Calculated matrix prices create valid Shopify Draft Orders with custom locked pricing. This phase builds the price lookup logic, Draft Order creation via Shopify GraphQL API, and a test flow for merchant verification. The public REST API that external storefronts call is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Price calculation logic
- Between-breakpoint dimensions: always round UP to the next higher breakpoint
- Grid intersection lookup: round width to its breakpoint independently, round height to its breakpoint independently, find the cell at that intersection
- Dimensions above largest breakpoint: clamp to largest breakpoint price (no rejection)
- Dimensions below smallest breakpoint: clamp to smallest breakpoint price (minimum order size)
- Zero and negative dimensions: reject with clear error
- Quantity support: yes, line item qty = customer quantity, total = unit price x qty

### Draft Order contents
- Line item custom properties: include width, height, and unit (e.g., "Width: 180mm, Height: 300mm")
- Tagging: add `price-matrix` tag for merchant filtering in Shopify admin
- No order notes — tag is sufficient
- Draft Order title: custom with product name + dimensions (e.g., "Custom Print - 180x300mm")
- No customer email at creation — customer provides email during Shopify checkout completion
- Dimensions displayed in merchant's configured unit preference (mm or cm from app settings)

### Error & edge case handling
- Shopify API failures: retry with exponential backoff (2-3 attempts)
- Product without matrix: return clear error ("No pricing matrix assigned to this product")
- Local order history: store a record of each Draft Order created (order ID, product, dimensions, calculated price, timestamp)
- Status tracking: creation record only — no webhook lifecycle sync. Merchant checks Shopify admin for current order status.

### Admin visibility
- Dashboard: minimal — show total Draft Orders created count, not a full order history page
- Test flow: test button on matrix detail page where merchant enters sample dimensions and creates a real Draft Order in Shopify to verify pricing works
- Merchants identify matrix-priced orders in Shopify admin via the `price-matrix` tag filter

### Claude's Discretion
- Retry timing and backoff strategy details
- Local order history database schema
- Test button UI placement and form design on matrix page
- Error message wording and format

</decisions>

<specifics>
## Specific Ideas

- Draft Order title should show product name + dimensions at a glance (e.g., "Custom Print - 180x300mm") so merchants can identify orders without opening them
- Test button on matrix page serves double duty: merchant onboarding verification + Phase 3 end-to-end testing before Phase 4 API exists

</specifics>

<deferred>
## Deferred Ideas

- Webhook-based order lifecycle tracking (draft -> completed -> paid) — could be Phase 6 polish if merchants want in-app reporting
- Full order history page in app dashboard — deferred, Shopify admin with tag filtering is sufficient for v1

</deferred>

---

*Phase: 03-draft-orders-integration*
*Context gathered: 2026-02-05*
