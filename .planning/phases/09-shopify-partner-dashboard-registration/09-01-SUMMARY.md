---
phase: 09-shopify-partner-dashboard-registration
plan: 01
subsystem: infra
tags: [shopify, partner-dashboard, distribution, deploy, toml]

requires:
  - phase: 08-production-deploy-to-vercel
    provides: Production URL (quote-flow-one.vercel.app) and Shopify app client_id
provides:
  - Public distribution enabled for QuoteFlow
  - App version deployed to Partner Dashboard with correct scopes, URLs, webhooks
affects: [09-02-oauth-test, 10-e2e-verification]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - shopify.app.production.toml

key-decisions:
  - "Selected Public distribution (irreversible) — required for App Store listing and Billing API"
  - "Completed Shopify App Store registration ($19 one-time fee) as prerequisite for Public distribution"

duration: 6min
completed: 2026-02-08
---

# Phase 09 Plan 01: Select Public Distribution & Deploy Production TOML Summary

**Public distribution selected for QuoteFlow and app version quoteflow-4 deployed to Partner Dashboard with production URLs, scopes, and webhooks**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-08T14:03:40Z
- **Completed:** 2026-02-08T14:09:45Z
- **Tasks:** 2
- **Files modified:** 0 (configuration changes in Partner Dashboard, no code changes)

## Accomplishments
- Registered for Shopify App Store ($19 one-time fee, individual developer)
- Selected Public distribution for QuoteFlow (permanent, enables App Store + Billing API)
- Deployed production TOML to Partner Dashboard via `shopify app deploy`
- App version quoteflow-4 released with correct configuration:
  - application_url: https://quote-flow-one.vercel.app
  - redirect_urls: https://quote-flow-one.vercel.app/auth/callback
  - scopes: write_draft_orders, read_products, write_products
  - embedded: true
  - webhooks: app/uninstalled

## Task Commits

1. **Task 1: Select Public distribution** - Human action (Partner Dashboard UI)
2. **Task 2: Deploy production TOML** - No code changes; `shopify app deploy --config shopify.app.production.toml` pushed config to Partner Dashboard

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- No code files modified — all changes were Partner Dashboard configuration via `shopify app deploy`

## Decisions Made
- Selected Public distribution (irreversible choice) — correct for App Store + Billing API goals
- Completed App Store registration as individual developer ($19 one-time fee)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shopify App Store registration required before Public distribution**
- **Found during:** Task 1 (Select Public distribution)
- **Issue:** Partner Dashboard required App Store registration ($19 fee) before allowing Public distribution selection
- **Fix:** User completed registration form (individual, single account, payment)
- **Verification:** Public distribution selection became available and was completed
- **No commit** (external service configuration)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor prerequisite step; no scope creep.

## Issues Encountered
None

## Next Phase Readiness
- Public distribution active — app can now be installed on development stores
- App version deployed — OAuth redirects and scopes configured in Partner Dashboard
- Ready for 09-02: Test OAuth install flow on development store

---
*Phase: 09-shopify-partner-dashboard-registration*
*Completed: 2026-02-08*
