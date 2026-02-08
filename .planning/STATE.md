# Project State: Shopify Price Matrix App

**Last Updated:** 2026-02-08
**Status:** v1.1 Milestone Complete

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core Value:** Merchants can offer custom-dimension pricing on their headless Shopify storefronts without building their own pricing infrastructure

**Current Focus:** v1.1 Publish & Polish — all phases complete, E2E verified in production

## Current Position

**Milestone:** v1.1 Publish & Polish
**Phase:** 10 of 4 (E2E Production Verification)
**Plan:** 2 of 2 complete
**Status:** Phase 10 complete — full E2E flow verified in production
**Last activity:** 2026-02-08 — Completed 10-02-PLAN.md (npm Widget Integration Test)

Progress: ██████████████████████████████ 100% (31/31 plans)
[Phases 01-06: Complete] [Phase 07: Complete] [Phase 08: Complete] [Phase 09: Complete] [Phase 10: Complete]

## Archived

- `.planning/milestones/v1.0-ROADMAP.md` — Full phase details
- `.planning/milestones/v1.0-REQUIREMENTS.md` — All v1 requirements
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — Audit report

## Accumulated Context

- Billing gates disabled for testing (TODO markers in `billing.server.ts`)
- Competitor research completed — Apippa is market leader, key gaps identified (true matrix grid, admin lookup, REST API, CSV import)
- Template CSV file added at `public/template.csv`
- Widget package prepared for npm: MIT license, comprehensive README (145 lines), all metadata complete
- npm package verified at 194.7 kB tarball with pack/publish dry-run checks passing
- Widget published to npm as @gjrkdk/pricing-matrix-widget@0.1.0 (scope changed from @pricing-matrix due to unavailability)
- Local .npmrc added to override global GitHub Package Registry redirect
- App renamed to QuoteFlow for production branding
- Production deployment: https://quote-flow-one.vercel.app (Vercel fra1 + Neon EU Central)
- Vercel builds use `remix vite:build` directly (Shopify CLI not available on Vercel)
- Root .npmrc has legacy-peer-deps=true for vitest/@shopify/cli-kit peer dep conflict
- Shopify App Store registration completed ($19 one-time fee, individual developer)
- Public distribution selected for QuoteFlow (irreversible) — enables App Store + Billing API
- App version quoteflow-6 deployed to Partner Dashboard via `shopify app deploy`
- pg.defaults.ssl = true required for Neon — Shopify session storage ignores URL sslmode params
- OAuth install flow verified on dynamic-pricing-demo.myshopify.com
- Switched to `use_legacy_install_flow = true` for proper offline session tokens
- Removed `unstable_newEmbeddedAuthStrategy` — incompatible with legacy install flow
- CORS preflight fix: OPTIONS handled before auth middleware in API routes
- E2E verified: install → matrix → Price API → Draft Order API → Shopify admin → widget rendering

## Session Continuity

**Last session:** 2026-02-08 17:25:00 UTC
**Stopped at:** Completed Phase 10 — v1.1 milestone fully verified
**Resume file:** None

---
*State tracked since: 2026-02-03*
