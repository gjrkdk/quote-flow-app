# Plan 10-01 Summary: Full E2E Flow Test

**Status:** Complete
**Date:** 2026-02-08

## Objective

Verify the complete end-to-end production flow from app installation through Draft Order creation on a Shopify development store.

## Results

### Task 1: Install App and Create Test Matrix

- **Store:** pricing-app-3.myshopify.com (dynamic-pricing-demo.myshopify.com)
- **App:** QuoteFlow at quote-flow-one.vercel.app
- **Matrix:** "E2E Test Glass 6mm" — 3x3 grid, mm units
  - Width breakpoints: 300, 600, 900
  - Height breakpoints: 300, 600, 900
  - Prices: 50/100/150, 100/150/200, 150/200/250
- **Product GID:** 8183899324486
- **Result:** PASS — App installed via OAuth, dashboard rendered, matrix created and assigned

### Task 2: REST API and Draft Order Verification

| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Price API — exact breakpoint | 300x300, qty 1 | price: 50 | price: 50 | PASS |
| Price API — snap-up | 450x450, qty 2 | price: 150, total: 300 | price: 150, total: 300 | PASS |
| Draft Order API — exact | 300x300, qty 1 | Draft Order with total 50 | #D30, total: 50.00 | PASS |
| Draft Order API — snap-up | 450x450, qty 2 | Draft Order with total 300 | #D31, total: 300.00 | PASS |
| Draft Orders in Shopify admin | #D30, #D31 visible | Correct line items | Verified by merchant | PASS |

## Issues Found and Fixed

### 1. Offline session tokens invalid (3 commits)

**Root cause:** `unstable_newEmbeddedAuthStrategy` + managed installation (`use_legacy_install_flow=false`) created sessions with tokens that didn't work for the production app's client_id.

**Fixes applied:**
- `3dd04df` — Export `sessionStorage`, use offline session token in Draft Order API
- `d8f69ba` — Remove `unstable_newEmbeddedAuthStrategy` for proper offline sessions
- `1feaebe` — Switch to `use_legacy_install_flow = true` with shop-specific webhooks

### 2. CORS preflight returning 401

**Root cause:** OPTIONS requests routed through Remix `loader` hit authentication middleware before CORS handler.

**Fix:** `29e3eba` — Handle OPTIONS at top of loader before authentication, return 204 with CORS headers.

## Commits

- `3dd04df` fix(10-01): use offline session token for Draft Order API
- `d8f69ba` fix(10-01): remove unstable_newEmbeddedAuthStrategy for offline sessions
- `1feaebe` fix(10-01): switch to legacy install flow for proper offline sessions
- `29e3eba` fix(10): handle CORS preflight before authentication in API routes
