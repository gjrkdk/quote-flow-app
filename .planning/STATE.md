# Project State: Shopify Price Matrix App

**Last Updated:** 2026-02-03
**Status:** Planning (Roadmap Complete)

## Project Reference

**Core Value:** Merchants can offer custom-dimension pricing on their headless Shopify storefronts without building their own pricing infrastructure

**What This Is:** A public Shopify app with three components: (1) embedded admin dashboard for matrix configuration, (2) REST API for headless storefronts to fetch pricing, (3) drop-in React widget for easy integration. Merchants define breakpoint grids (width x height), assign them to products, and customers get real-time dimension-based pricing with checkout via Draft Orders.

**Current Focus:** Roadmap created. Ready to plan Phase 1 (Foundation & Authentication).

## Current Position

**Phase:** Not started
**Plan:** Not created
**Status:** Awaiting `/gsd:plan-phase 1`

**Progress Bar:**
```
[                    ] 0% (0/21 requirements complete)

Phase 1: Foundation & Authentication       [          ] 0/4
Phase 2: Admin Matrix Management           [          ] 0/6
Phase 3: Draft Orders Integration          [          ] 0/1
Phase 4: Public REST API                   [          ] 0/4
Phase 5: React Widget (npm Package)        [          ] 0/5
Phase 6: Polish & App Store Preparation    [          ] 0/1
```

## Performance Metrics

**Velocity:** N/A (no completed plans yet)
**Blockers:** 0
**Active Research:** 0

**Phase History:**
| Phase | Planned | Completed | Duration | Status |
|-------|---------|-----------|----------|--------|
| (none) | - | - | - | - |

## Accumulated Context

### Key Decisions

**Made:**
- Roadmap structure: 6 phases following dependency chain (Foundation → Admin → Orders → API → Widget → Polish)
- Success criteria defined with observable user behaviors (not implementation tasks)
- Research flags set for Phase 3 (Draft Orders) and Phase 4 (REST API security)

**Pending:**
- Tech stack specifics (Remix version, Prisma setup, Vercel config) - decided during Phase 1 planning
- Matrix size limits (100x100 from research) - validated during Phase 2
- Rate limiting strategy (in-memory vs Redis) - decided during Phase 4 planning
- Pricing model (subscription vs one-time) - decided during Phase 6

### Open Todos

**Immediate:**
- [ ] Run `/gsd:plan-phase 1` to create execution plan for Foundation & Authentication

**Upcoming:**
- [ ] Research Draft Orders behavior during Phase 3 planning
- [ ] Research API security patterns (HMAC, rate limiting) during Phase 4 planning

### Known Blockers

(None - project just initialized)

### Anti-Patterns to Avoid

From research:
1. Third-party cookies for embedded sessions - use session tokens
2. Prisma connection exhaustion on Vercel - configure pooling from start
3. Missing GDPR webhooks - register in Phase 1
4. Draft Orders rate limits - implement retry logic in Phase 3
5. API without HMAC verification - design into Phase 4 from start

## Session Continuity

**Last Command:** `/gsd:new-project` (via orchestrator)
**Next Command:** `/gsd:plan-phase 1`

**What Just Happened:**
- Orchestrator initialized project structure
- Requirements defined (21 v1 requirements across 5 categories)
- Research completed (6-phase structure suggested, pitfalls identified)
- Roadmap created with 100% requirement coverage

**What Comes Next:**
- Plan Phase 1 (Foundation & Authentication) with 3-5 executable plans
- Plans will cover: OAuth setup, session token auth, Prisma schema, connection pooling, GDPR webhooks

**Context for Next Agent:**
- Depth = standard (3-5 plans per phase expected)
- Phase 1 has 4 requirements (INFRA-01 to INFRA-04)
- Success criteria focus on working OAuth install, session persistence, API key generation, GDPR webhook response
- Research suggests using Shopify Remix template as starting point (standard patterns, skip deep research)

---
*State tracked since: 2026-02-03*
