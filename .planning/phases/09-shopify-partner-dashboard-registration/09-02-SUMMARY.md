---
phase: 09-shopify-partner-dashboard-registration
plan: 02
subsystem: infra
tags: [shopify, oauth, embedded-app, session-storage, neon, pg, ssl]

requires:
  - phase: 09-01
    provides: Public distribution selected, app version deployed to Partner Dashboard
  - phase: 08-02
    provides: Production Vercel deployment at quote-flow-one.vercel.app
provides:
  - Verified OAuth install flow on production deployment
  - SSL fix for pg session storage on Neon (pg.defaults.ssl)
affects: [10-e2e-verification]

tech-stack:
  added: []
  patterns:
    - "pg.defaults.ssl = true for Neon SSL in Shopify session storage"

key-files:
  created: []
  modified:
    - app/shopify.server.ts

key-decisions:
  - "Set pg.defaults.ssl globally for Neon SSL — Shopify session storage ignores URL sslmode params"
  - "Installed on dynamic-pricing-demo.myshopify.com (second dev store) for testing"

duration: 80min
completed: 2026-02-08
---

# Phase 09 Plan 02: Test OAuth Install Flow Summary

**OAuth install flow verified on production — pg.defaults.ssl fix for Neon session storage, embedded dashboard renders inside Shopify admin**

## Performance

- **Duration:** 80 min (including debugging SSL issue)
- **Started:** 2026-02-08T14:10:56Z
- **Completed:** 2026-02-08T15:31:36Z
- **Tasks:** 1 (checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments
- QuoteFlow installed successfully on dynamic-pricing-demo.myshopify.com via direct install link
- OAuth flow completes without errors (scopes approved, token exchanged, session created in Neon)
- Embedded dashboard renders Polaris UI inside Shopify admin
- Fixed critical SSL issue: Shopify's `@shopify/shopify-app-session-storage-postgresql` creates pg.Pool without SSL options, but Neon requires SSL

## Task Commits

1. **Task 1: Install and verify OAuth flow** — Human verification (approved)

Supporting commits:
- `4dc5c8b` — fix(09-02): enable SSL for pg session storage on Neon

## Files Created/Modified
- **app/shopify.server.ts** — Added `pg.defaults.ssl = true` for Neon connections, imported pg module

## Decisions Made
- Set `pg.defaults.ssl = true` globally when DATABASE_URL contains `neon.tech` — the Shopify session storage package parses the connection URL into individual fields (host, user, password, database, port) and completely ignores query parameters like `sslmode`. This means URL-based SSL configuration has no effect. Setting pg.defaults.ssl before Pool creation ensures SSL is used.
- Tested on dynamic-pricing-demo.myshopify.com instead of pricing-app-3 (which has the dev app)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shopify session storage ignores SSL params from URL**
- **Found during:** Task 1 (OAuth install attempt)
- **Issue:** `@shopify/shopify-app-session-storage-postgresql` v3.0.5 creates `pg.Pool` with individual fields extracted from URL, discarding all query params including `sslmode=require`. Neon requires SSL, so connections fail with "connection is insecure".
- **Fix:** Added `import pg from "pg"` and `pg.defaults.ssl = true` before PostgreSQLSessionStorage instantiation
- **Files modified:** app/shopify.server.ts
- **Verification:** App loads successfully in Shopify admin, dashboard renders
- **Committed in:** 4dc5c8b

**2. [Rule 1 - Bug] Missing shopify_sessions table in Neon**
- **Found during:** Task 1 (initial debugging)
- **Issue:** Session table didn't exist in production database (Prisma doesn't create it — the session storage adapter does)
- **Fix:** Created table manually via psql, but ultimately the adapter creates it automatically once SSL works
- **No commit** (database operation only)

**3. [Rule 3 - Blocking] Vercel env vars on wrong project**
- **Found during:** Task 1 (initial debugging)
- **Issue:** `vercel link` connected to `pricing-app` project instead of `quote-flow` (the actual production project)
- **Fix:** Re-linked to `quote-flow` project, verified env vars were already set correctly there
- **No commit** (CLI configuration only)

---

**Total deviations:** 3 (1 bug fix committed, 2 operational fixes)
**Impact on plan:** SSL fix was critical for production functionality. No scope creep.

## Issues Encountered
- Three failed deployment attempts before identifying the root cause (pg.Pool ignoring URL params)
- URL-based fixes (`uselibpqcompat=true`, `sslmode=no-verify`) had no effect because the session storage package doesn't pass URL params to pg.Pool
- Root cause required reading the session storage package source code to understand the connection creation path

## Next Phase Readiness
- Phase 09 complete — all requirements met (APP-01, APP-02, APP-03)
- Ready for Phase 10: E2E Production Verification
- Production app installs and authenticates successfully
- Embedded dashboard renders Polaris UI

---
*Phase: 09-shopify-partner-dashboard-registration*
*Completed: 2026-02-08*
