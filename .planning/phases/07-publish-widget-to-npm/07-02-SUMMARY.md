---
phase: 07-publish-widget-to-npm
plan: 02
subsystem: infra
tags: [npm, publishing, widget]

requires:
  - phase: 07-01
    provides: "Package metadata, README, LICENSE, verified build"
provides:
  - "@gjrkdk/pricing-matrix-widget published to npm at 0.1.0"
  - "npm registry configuration (.npmrc) to override global GitHub Package Registry"
affects: [10-e2e-verification]

tech-stack:
  added: []
  patterns: ["npm scoped public package publishing"]

key-files:
  created: ["packages/widget/.npmrc"]
  modified: ["packages/widget/package.json", "packages/widget/README.md"]

key-decisions:
  - "Changed scope from @pricing-matrix to @gjrkdk (user npm username) due to scope unavailability"
  - "Published as scoped public package with --access public"
  - "Added .npmrc to override global GitHub Package Registry redirect for @gjrkdk scope"

duration: ~5min
completed: 2026-02-07
---

# Phase 07 Plan 02: Publish to npm Summary

**@gjrkdk/pricing-matrix-widget@0.1.0 published to npm registry with ES/UMD builds and TypeScript types**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-07
- **Completed:** 2026-02-07
- **Tasks:** 3 (1 auto, 1 checkpoint, 1 auto)
- **Files modified:** 3

## Accomplishments
- Package scope changed from @pricing-matrix to @gjrkdk (personal npm username)
- Package published to npm as @gjrkdk/pricing-matrix-widget@0.1.0
- Verified installation works in fresh project (194.7 kB tarball)
- Published tarball includes TypeScript types, ES + UMD builds, README, and LICENSE
- Added .npmrc to handle local registry configuration

## Task Commits

1. **Task 1: Check npm authentication status** - (verification only, no commit)
2. **Task 2: npm login** - (user action, no commit)
3. **Task 3: Publish to npm and verify** - `348a15a` (feat)

**Plan metadata:** `a7ab203` (docs: complete plan)

## Files Created/Modified
- `packages/widget/.npmrc` - Registry override for @gjrkdk scope to use npm public registry
- `packages/widget/package.json` - Changed name to @gjrkdk/pricing-matrix-widget
- `packages/widget/README.md` - Updated all package name references

## Decisions Made
- **Scope change:** Changed package scope from @pricing-matrix to @gjrkdk — the @pricing-matrix npm org didn't exist, user chose to publish under personal npm username scope
- **Registry config:** Added .npmrc to override user's global GitHub Package Registry configuration that was redirecting @gjrkdk scope installs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed npm scope from @pricing-matrix to @gjrkdk**
- **Found during:** Task 3 (Publish to npm)
- **Issue:** @pricing-matrix scope doesn't exist on npm, publish would have returned 404
- **Fix:** Changed package name to @gjrkdk/pricing-matrix-widget, updated README references
- **Files modified:** packages/widget/package.json, packages/widget/README.md
- **Verification:** npm publish succeeded, npm view shows package metadata
- **Committed in:** 348a15a (Task 3 commit)

**2. [Rule 3 - Blocking] Added .npmrc for registry override**
- **Found during:** Task 3 (Installation verification)
- **Issue:** User's global .npmrc redirects @gjrkdk scope to GitHub Package Registry, breaking npm installs
- **Fix:** Added packages/widget/.npmrc with `@gjrkdk:registry=https://registry.npmjs.org/`
- **Files modified:** packages/widget/.npmrc (created)
- **Verification:** Test installation with custom userconfig succeeded
- **Committed in:** 348a15a (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Scope change and registry config were necessary to publish and enable installation. No functional impact — package works identically under new name.

## Issues Encountered
None beyond the scope change and registry configuration handled above.

## Authentication Gates

1. **Task 2:** npm CLI required browser-based authentication — paused for `npm login`
2. **Task 3:** npm publish required Touch ID 2FA — user ran publish command directly

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Widget published and installable via `npm install @gjrkdk/pricing-matrix-widget`
- Ready for Phase 08 (Vercel deploy) and Phase 10 (E2E verification)
- **Note:** Phase 10 E2E tests should use @gjrkdk/pricing-matrix-widget (not @pricing-matrix/widget)
- **Note:** Consumers with .npmrc @gjrkdk scope redirects will need to override or use local .npmrc

---
*Phase: 07-publish-widget-to-npm*
*Completed: 2026-02-07*

## Self-Check: PASSED

All commits verified:
- 348a15a: feat(07-02): publish @gjrkdk/pricing-matrix-widget to npm

All key files verified:
- packages/widget/.npmrc (created)
