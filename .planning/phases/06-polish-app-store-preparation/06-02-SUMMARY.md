---
phase: 06
plan: 02
subsystem: billing
tags: [shopify-billing-api, freemium, subscription, app-store]
requires: [05-04]
provides:
  - Shopify Billing API configuration with freemium plan
  - Billing check utilities for plan enforcement
  - Matrix creation gating based on billing tier
affects: [06-04]
tech-stack:
  added: []
  patterns:
    - Shopify Billing API integration
    - Freemium tier enforcement
decisions:
  - Plan pricing set at $12/month with 14-day trial
  - Free tier limited to 1 matrix
  - Paid tier enables unlimited matrices and CSV import
  - isTest flag derived from NODE_ENV for development
key-files:
  created:
    - app/services/billing.server.ts
  modified:
    - app/shopify.server.ts
metrics:
  duration: 171s
  completed: 2026-02-06
---

# Phase 06 Plan 02: Freemium Billing Setup Summary

**One-liner:** Configured Shopify Billing API with $12/mo unlimited plan (14-day trial) and created utilities for freemium tier enforcement (1 free matrix, paid for unlimited).

## What Was Built

### 1. Shopify Billing API Configuration
Added billing configuration to `shopify.server.ts`:
- **Plan Name:** UNLIMITED_PLAN
- **Pricing:** $12.00 USD per month
- **Billing Interval:** Every 30 days
- **Trial Period:** 14 days
- **Replacement Behavior:** Apply immediately (for plan upgrades/changes)

Imported `BillingReplacementBehavior` from `@shopify/shopify-api` and `BillingInterval` from Remix server package.

### 2. Billing Check Utilities
Created `app/services/billing.server.ts` with three core functions:

**`checkBillingStatus(request: Request)`**
- Authenticates admin session
- Calls `billing.check()` with UNLIMITED_PLAN
- Uses `isTest` flag based on `NODE_ENV` (development vs production)
- Returns `{ hasActivePayment, needsUpgrade }`

**`requirePaidPlan(request: Request)`**
- Checks billing status
- Returns upgrade details if no active payment (plan name, price, features)
- Returns `{ needsUpgrade: false }` if paid

**`canCreateMatrix(request: Request, currentMatrixCount: number)`**
- Enforces free tier limit (1 matrix)
- Allows creation if under limit
- Checks billing status if at/over limit
- Returns `{ allowed, reason?, limit? }` for UI feedback

**Exported Constants:**
- `PLAN_NAME = "UNLIMITED_PLAN"`
- `PLAN_PRICE = "$12/month"`
- `FREE_MATRIX_LIMIT = 1`
- `PLAN_FEATURES = ["Unlimited matrices", "CSV import"]`

## Task Commits

| Task | Name | Commit | Files | Duration |
|------|------|--------|-------|----------|
| 1 | Configure Shopify Billing API | 13ed0c3 | app/shopify.server.ts | ~1min |
| 2 | Create billing check utilities | ad51cf0 | app/services/billing.server.ts | ~1min |

**Total Duration:** 171 seconds (~3 minutes)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

**Plan Pricing Decision:**
- Confirmed $12/month pricing from Phase 06 discretion
- 14-day trial aligns with Shopify app best practices
- "UNLIMITED_PLAN" naming reflects paid tier value proposition

**isTest Flag Implementation:**
- Used `process.env.NODE_ENV !== "production"` for development mode
- Prevents charging test/dev stores during development
- Production apps will use real billing

**Free Tier Enforcement:**
- Single matrix limit provides meaningful functionality for evaluation
- Clear upgrade path to unlimited matrices
- CSV import gated behind paid tier (to be implemented in Plan 04)

## Must-Have Verification

**Truths:**
- ✅ Shopify Billing API configured with freemium plan
- ✅ Free tier allows 1 matrix, paid tier allows unlimited
- ✅ Billing check utility determines active paid plan status
- ✅ Matrix count enforcement prevents free stores from exceeding limit

**Artifacts:**
- ✅ `app/services/billing.server.ts` exports: checkBillingStatus, requirePaidPlan, canCreateMatrix, PLAN_NAME, PLAN_PRICE
- ✅ `app/shopify.server.ts` contains billing configuration

**Key Links:**
- ✅ billing.server.ts imports authenticate.admin from shopify.server.ts
- ✅ Uses billing.check pattern from Shopify API

## Technical Notes

### Shopify Billing API Pattern
The billing check pattern follows Shopify's recommended approach:
1. Call `authenticate.admin(request)` to get billing context
2. Use `billing.check({ plans: [PLAN_NAME], isTest })` for non-blocking checks
3. Use `billing.require({ plans, onFailure })` for enforced checks (not used in utilities, but available for routes)

### Future Integration Points
The utilities are ready for integration in:
1. **Matrix creation route** (`app/routes/app.matrices.new.tsx`) - call `canCreateMatrix()` before allowing creation
2. **CSV import route** (Plan 06-04) - call `requirePaidPlan()` to gate feature
3. **Settings page** - display current plan status and upgrade CTA

### Type Safety
All functions return strongly-typed interfaces:
- `BillingStatusResult`
- `RequirePaidPlanResult`
- `CanCreateMatrixResult`

TypeScript compilation passes with no billing-related errors.

## Next Phase Readiness

**Ready for Plan 06-03:** Admin UI enhancements can now reference billing status for upgrade CTAs.

**Ready for Plan 06-04:** CSV import route can call `requirePaidPlan()` to enforce paid-tier gating.

**Blockers:** None

**Concerns:** None - billing configuration is standard Shopify pattern.

## Self-Check: PASSED

**Created files verified:**
- ✅ app/services/billing.server.ts exists

**Commits verified:**
- ✅ 13ed0c3 exists (Configure Shopify Billing API)
- ✅ ad51cf0 exists (Create billing check utilities)

**Configuration verified:**
- ✅ UNLIMITED_PLAN in shopify.server.ts
- ✅ $12/month pricing configured
- ✅ 14-day trial configured
- ✅ Free limit is 1 matrix
