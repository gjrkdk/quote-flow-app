# Plan 02-05: Human Verification — Summary

**Status:** Complete
**Completed:** 2026-02-04

## What Happened

Human verification of the complete Phase 2 matrix management flow. All 6 requirements (MATRIX-01 through MATRIX-06) tested end-to-end in the dev store.

## Issues Found & Fixed

1. **Dashboard "Create Matrix" button non-functional** — Button had no onClick handler. Fixed by adding `useNavigate` navigation to `/app/matrices/new`.

2. **"Missing shop parameter" on navigation** — Polaris `url` props render plain `<a>` tags causing full-page navigations that lose session token context in embedded apps. Fixed across 4 files by replacing `url` with `onAction`/`onClick` using Remix's `useNavigate`.

3. **Duplicate matrix crashes server** — `navigate()` called during render (not in useEffect) caused React issues and connection drops. Fixed by using Remix's `redirect()` server-side instead.

## Verification Results

| Test | Result |
|------|--------|
| Settings unit preference (mm/cm) | PASS |
| Create matrix with template | PASS |
| Edit grid (prices, breakpoints) | PASS |
| Save and persist | PASS |
| Product assignment (Resource Picker) | PASS |
| Delete matrix | PASS |
| Duplicate matrix | PASS (after fix) |
| Matrix list display | PASS |
| Unit conversion in templates | PASS |

## Commits

- 0bc7743: fix(02-05): use client-side navigation and fix duplicate redirect

## Lessons Learned

- **[02-UAT]** In embedded Shopify apps with `unstable_newEmbeddedAuthStrategy`, never use Polaris `url` props for navigation. Always use Remix's `useNavigate` hook for client-side navigation to preserve session token context.
- **[02-UAT]** Never call `navigate()` during render. Use `useEffect` or server-side `redirect()`.
