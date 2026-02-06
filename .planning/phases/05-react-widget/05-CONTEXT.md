# Phase 5: React Widget (npm Package) - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Drop-in React component published as an npm package. Developers install it, pass required props, and customers get dimension inputs with live pricing and Draft Order checkout. Widget uses Shadow DOM for CSS isolation. Theming, analytics, and advanced cart integrations are out of scope for v1.

</domain>

<decisions>
## Implementation Decisions

### Widget Inputs & Interaction
- Text fields only for width and height (no sliders)
- Display merchant's configured unit (cm or mm) — fetched from API, not a developer prop
- Inline validation errors under each field (e.g., "Width must be between 30-100 cm")
- Show valid dimension range upfront as placeholder/helper text so customers know bounds before typing

### Price Display & Loading
- Total price only — no breakdown (unit price, dimensions, etc.)
- Debounced price fetch ~300-500ms after customer stops typing
- Skeleton/shimmer placeholder while price is loading
- No price shown until customer enters valid width and height (empty initial state)

### Add-to-Cart Flow
- "Add to Cart" creates Draft Order and redirects to Shopify checkout
- Quantity selector with +/- buttons included
- Button disabled until both dimensions are valid and price is loaded
- Loading spinner inside button while Draft Order is being created

### Developer API & Props
- Three required props: `apiKey`, `productId`, `apiUrl` (no hardcoded default URL)
- Theming via CSS custom properties (e.g., `--pm-primary-color`) as default, with optional `theme` prop object that sets them
- Single callback: `onAddToCart` — fires when Draft Order is created. Minimal API surface for v1.
- Currency formatting automatic — API returns currency code, widget uses browser `Intl.NumberFormat`

### Claude's Discretion
- Debounce timing (300-500ms range)
- Exact CSS custom property names and defaults
- Shadow DOM implementation details
- Internal component structure and state management
- npm package naming and build tooling

</decisions>

<specifics>
## Specific Ideas

- API response needs a `currency` field added (e.g., "USD") so widget can format prices automatically
- API response should include dimension range (min/max width/height) so widget can show placeholder hints and validate client-side without extra API calls
- Merchant's unit preference (cm/mm) should also come from API response

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-react-widget*
*Context gathered: 2026-02-06*
