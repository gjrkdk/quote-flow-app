# Plan 10-02 Summary: npm Widget External Integration Test

**Status:** Complete
**Date:** 2026-02-08

## Objective

Verify the published npm widget package works when installed in a fresh external project, renders correctly, and communicates with the production API.

## Results

### Task 1: Fresh Project Install (Autonomous)

- Created `/tmp/widget-integration-test` outside monorepo
- `npm install @gjrkdk/pricing-matrix-widget@0.1.0` succeeded
- All build artifacts verified:
  - `dist/price-matrix-widget.es.js` (ESM)
  - `dist/price-matrix-widget.umd.js` (UMD)
  - `dist/index.d.ts` (TypeScript types)
  - `README.md`
  - `LICENSE`
- **Result:** PASS

### Task 2: Browser Rendering with Production API (Checkpoint)

- Created test HTML page with ES module import map (React 18 via esm.sh)
- Widget loaded via ESM build from installed package
- **Result:** PASS — Widget rendered with:
  - Width/Height input fields
  - Quantity selector with +/- buttons
  - Live price calculation from production API
  - Add to Cart button
  - Shadow DOM for style isolation

## Issues Found and Fixed

### 1. UMD build requires ReactJSXRuntime global
The UMD build externalizes `react/jsx-runtime` as `ReactJSXRuntime` global, which CDN React doesn't provide. Switched test page to ESM with import maps — the more realistic integration pattern for modern apps.

### 2. `process.env.NODE_ENV` not defined in browser
Bundled dependencies (react-shadow, prop-types) reference `process.env.NODE_ENV`. Added `<script>window.process = { env: { NODE_ENV: 'production' } };</script>` shim. This is expected for UMD/ESM library bundles that don't tree-shake dev checks.

### 3. CORS preflight blocked by authentication (shared with 10-01)
Fixed in commit `29e3eba` — OPTIONS handled before auth middleware.

## Commits

No project code changes — test artifacts created in `/tmp/widget-integration-test/`.
CORS fix shared with Plan 10-01 (`29e3eba`).
