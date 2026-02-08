---
phase: quick
plan: 001-rename-widget-package
subsystem: widget
tags: [refactor, branding, npm]
dependency_graph:
  requires: []
  provides: ["@gjrkdk/quote-flow npm package"]
  affects: ["widget consumers", "documentation"]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - packages/widget/package.json
    - packages/widget/vite.config.ts
    - packages/widget/README.md
    - packages/widget/package-lock.json
    - .planning/STATE.md
    - .planning/PROJECT.md
    - .planning/MILESTONES.md
decisions: []
metrics:
  duration: 115s
  completed: 2026-02-08T17:44:00Z
---

# Quick Task 001: Rename Widget Package

**One-liner:** Renamed npm package from @gjrkdk/pricing-matrix-widget to @gjrkdk/quote-flow to align with QuoteFlow product branding.

## Context

The widget was initially published as `@gjrkdk/pricing-matrix-widget@0.1.0` during v1.1 milestone. With the product branding established as "QuoteFlow" (visible in production URL, project docs), the package name should match for consistency and discoverability.

## Tasks Completed

### Task 1: Rename package identity and build outputs
**Commit:** c429543
**Files:** packages/widget/package.json, packages/widget/vite.config.ts

- Changed package.json `name` from `@gjrkdk/pricing-matrix-widget` to `@gjrkdk/quote-flow`
- Updated all entry point paths: main, module, exports.import, exports.require
- Changed vite.config.ts UMD global name from `PriceMatrixWidget` to `QuoteFlow`
- Updated fileName function to produce `quote-flow.es.js` and `quote-flow.umd.js`
- Replaced `widget` keyword with `quote-flow`
- Build outputs verified: dist/ contains correctly named files

**Note:** React component `PriceMatrixWidget` and its file remain unchanged — this is package identity only, not a breaking API change.

### Task 2: Update README and regenerate package-lock.json
**Commit:** 2c3ea6a
**Files:** packages/widget/README.md, packages/widget/package-lock.json

- Updated title from `# @gjrkdk/pricing-matrix-widget` to `# @gjrkdk/quote-flow`
- Changed install command to reference new package name
- Updated import examples (package path changed, component name unchanged)
- Regenerated package-lock.json to reflect new package identity
- Verified zero remaining references to old name in widget package

### Task 3: Update planning docs to reflect new package name
**Commit:** 7a65ba4
**Files:** .planning/STATE.md, .planning/PROJECT.md, .planning/MILESTONES.md

- Updated STATE.md widget reference
- Updated PROJECT.md requirements and current state sections
- Updated MILESTONES.md v1.1 accomplishments
- Preserved historical phase docs (under .planning/phases/) with original package name for accuracy

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria passed:

1. `npm run build` succeeds
2. dist/ contains: quote-flow.es.js, quote-flow.umd.js, index.d.ts
3. No references to `@gjrkdk/pricing-matrix-widget` in package.json, README.md, or main planning docs
4. New name `@gjrkdk/quote-flow` present in all expected locations

## Impact

**Breaking change for existing consumers:** NO - Package not yet published under new name. Current npm package (@gjrkdk/pricing-matrix-widget@0.1.0) remains published. Next `npm publish` will be under the new name.

**Next steps:**
1. Run `npm publish` from packages/widget/ to publish @gjrkdk/quote-flow@0.1.0
2. Consider deprecating @gjrkdk/pricing-matrix-widget on npm with pointer to new package
3. Update any external documentation or examples

## Self-Check: PASSED

**Created files:** None (all edits to existing files)

**Modified files:**
- packages/widget/package.json: FOUND
- packages/widget/vite.config.ts: FOUND
- packages/widget/README.md: FOUND
- packages/widget/package-lock.json: FOUND
- .planning/STATE.md: FOUND
- .planning/PROJECT.md: FOUND
- .planning/MILESTONES.md: FOUND

**Commits:**
- c429543: FOUND
- 2c3ea6a: FOUND
- 7a65ba4: FOUND

**Build artifacts:**
- packages/widget/dist/quote-flow.es.js: FOUND
- packages/widget/dist/quote-flow.umd.js: FOUND
- packages/widget/dist/index.d.ts: FOUND
