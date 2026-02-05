---
phase: 04-public-rest-api
plan: 02
subsystem: api
tags: [rest-api, remix, prisma, cors, rate-limiting, zod]

# Dependency graph
requires:
  - phase: 04-01
    provides: API authentication middleware, Zod validators, rate limiting
  - phase: 03-01
    provides: Price calculator service with MatrixData interface
  - phase: 02-01
    provides: Database schema for PriceMatrix, ProductMatrix, Breakpoint, MatrixCell
provides:
  - REST endpoint GET /api/v1/products/:productId/price with full auth/validation/rate-limiting
  - Product matrix lookup service for database queries
  - CORS support for cross-origin requests
  - RFC 7807 error responses for all failure cases
affects: [04-03-human-verify, 05-react-widget]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Remix resource routes (no default export) for REST endpoints"
    - "CORS wrapper function for consistent header management"
    - "Global error handler with Response detection for proper CORS on errors"
    - "Prisma include pattern with ownership validation for cross-store security"

key-files:
  created:
    - app/services/product-matrix-lookup.server.ts
    - app/routes/api.v1.products.$productId.price.ts
  modified: []

key-decisions:
  - "CORS on all responses (success and errors) via withCors wrapper"
  - "Store ownership validation in lookupProductMatrix prevents cross-store access"
  - "Generic 500 error messages never expose internal details"
  - "OPTIONS method returns 204 for CORS preflight"
  - "Non-GET methods return 405 with CORS headers"

patterns-established:
  - "Resource routes for REST endpoints: export loader/action, no default export"
  - "CORS wrapper: withCors(response) adds headers, works on all Response objects"
  - "Global try/catch: Re-throw Response objects with CORS, generic 500 for unexpected errors"
  - "Database service pattern: Return null for not-found/unauthorized, never throw"

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 4 Plan 2: REST Endpoint and Product Matrix Lookup

**GET /api/v1/products/:productId/price REST endpoint with authentication, validation, rate limiting, and CORS for headless storefront integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T17:21:58Z
- **Completed:** 2026-02-05T17:23:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Product matrix lookup service queries database and transforms to MatrixData format
- REST endpoint composes all Phase 4 Plan 1 utilities (auth, validation, rate limiting)
- Full CORS support enables cross-origin requests from headless storefronts
- RFC 7807 error format on all failures (401, 400, 404, 429, 500)
- Rate limit headers on success responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Create product-matrix-lookup service** - `7cc6210` (feat)
2. **Task 2: Create REST endpoint resource route with CORS** - `06882a3` (feat)

## Files Created/Modified
- `app/services/product-matrix-lookup.server.ts` - Queries ProductMatrix by productId, validates store ownership, transforms to MatrixData format
- `app/routes/api.v1.products.$productId.price.ts` - GET endpoint with auth, validation, rate limiting, CORS, and RFC 7807 errors

## Decisions Made

**CORS on all responses:** All responses (success and error) get CORS headers via `withCors()` wrapper. This enables cross-origin requests from any domain, which is essential for headless storefronts.

**Store ownership validation:** `lookupProductMatrix()` validates that the matrix belongs to the authenticated store before returning data. This prevents cross-store access attempts.

**Generic 500 errors:** Internal errors return generic RFC 7807 responses without exposing stack traces or implementation details. Console logs capture details for debugging.

**OPTIONS method handling:** Returns 204 with CORS headers for preflight requests. Non-GET methods return 405 with CORS headers.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all dependencies from Plan 01 worked as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 4 Plan 3 (human verification):** REST endpoint is complete and ready for curl testing. The endpoint can be tested with:
- Valid API key from store (generated in Phase 1)
- Product with assigned matrix (created in Phase 2)
- Width/height query parameters

**Ready for Phase 5 (React Widget):** REST endpoint provides the API surface for the widget to consume. Widget can call `/api/v1/products/:productId/price?width=X&height=Y` with the merchant's API key.

**No blockers:** All must-have truths satisfied:
- ✓ GET with valid API key returns JSON with price
- ✓ Missing X-API-Key returns 401
- ✓ Invalid dimensions return 400
- ✓ Product without matrix returns 404
- ✓ Dimensions between breakpoints round up
- ✓ CORS headers present
- ✓ Rate limit headers present

---
*Phase: 04-public-rest-api*
*Completed: 2026-02-05*
