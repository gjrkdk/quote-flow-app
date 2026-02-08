# Phase 10: E2E Production Verification - Research

**Researched:** 2026-02-08
**Domain:** Production verification testing, manual smoke testing, npm package validation
**Confidence:** HIGH

## Summary

Phase 10 validates that all components shipped in v1.1 work together in production. This is **manual verification work**, not automated testing — the goal is to execute a real-world workflow from app installation through Draft Order creation using production URLs, published npm packages, and real Shopify stores.

The phase has two distinct verification streams: (1) Full E2E flow testing the complete merchant-to-customer journey using production infrastructure, and (2) Widget package validation confirming the published npm package integrates correctly in external projects. Both streams are primarily human-executed smoke tests with clear pass/fail criteria.

**Primary recommendation:** Structure this as 2-3 manual test plans with detailed step-by-step verification checklists. No code changes required — all infrastructure is already deployed and working from Phases 07-09.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| N/A | N/A | This is manual testing | No libraries required |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| curl or Postman | REST API verification | Testing price endpoint manually |
| Browser DevTools | Network/console debugging | Diagnosing failures during smoke tests |
| npm pack | Package validation | Testing npm package before external install |
| Fresh test projects | Widget integration testing | Verifying external project compatibility |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual testing | Playwright E2E automation | Automated tests provide repeatability but require setup time; manual is faster for one-time v1.1 validation |
| Manual verification | Vercel Checks API | Automated health checks good for CI/CD; manual testing better for comprehensive UX validation |
| Fresh project | npm link | npm link doesn't test the publish pipeline; npm pack + install tests actual tarball |

**Installation:**

No npm packages to install — this phase uses existing deployed infrastructure and the published npm widget.

## Architecture Patterns

### Recommended Test Structure

```
.planning/phases/10-e2e-production-verification/
├── 10-01-PLAN.md          # Full E2E flow test (install → matrix → API → Draft Order)
├── 10-02-PLAN.md          # Widget external integration test
└── 10-UAT.md              # User Acceptance Test results
```

### Pattern 1: Manual Smoke Test Plan

**What:** Human-executed verification checklist with clear success criteria for each step

**When to use:** Production verification where you need to validate UX, embedded app behavior, OAuth flows, and visual correctness

**Example structure:**
```markdown
<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Test full E2E flow</name>
  <how-to-verify>
    **Step 1: Install app**
    1. Navigate to Partner Dashboard install link
    2. Select fresh development store
    3. Approve OAuth scopes
    4. Expected: Land on embedded dashboard with Polaris UI

    **Step 2: Create price matrix**
    1. Copy API key from dashboard
    2. Create new matrix "Test Glass" with 3×3 breakpoints
    3. Assign to a product
    4. Expected: Matrix saves, product shows assigned matrix

    **Step 3: Test REST API**
    1. curl https://quote-flow-one.vercel.app/api/v1/products/{id}/price?width=100&height=200
    2. Include X-API-Key header
    3. Expected: Returns price matching matrix cell

    **Step 4: Test widget**
    1. Use published widget in test HTML page
    2. Enter dimensions matching matrix
    3. Click "Add to Cart"
    4. Expected: Draft Order created, checkout URL returned

    **Step 5: Verify Draft Order**
    1. Navigate to Shopify admin → Orders → Drafts
    2. Find newly created draft order
    3. Expected: Shows custom price, dimensions in line item title
  </how-to-verify>
  <resume-signal>
    Type "approved" if all steps passed, or describe exact failure
  </resume-signal>
</task>
```

### Pattern 2: npm Package External Integration Test

**What:** Install published npm package in a fresh React project and verify it renders/functions

**When to use:** Validating that published npm packages work for external developers (not just in the monorepo)

**Example:**
```bash
# Create fresh test project
mkdir test-widget-integration && cd test-widget-integration
npm init -y
npm install react react-dom @gjrkdk/pricing-matrix-widget

# Create test HTML/JS that imports and renders widget
# Verify: Widget renders, fetches price, creates Draft Order
```

### Pattern 3: UAT Results Document

**What:** Structured pass/fail tracking for all verification steps

**When to use:** All manual test phases to track outcomes and issues

**Example from Phase 09:**
```markdown
## Tests

### 1. OAuth Flow Completes
expected: After approving scopes, app installs successfully
result: pass

### 2. Embedded Dashboard Renders
expected: Dashboard loads with Polaris UI
result: pass

## Summary
total: 4
passed: 4
issues: 0
```

### Anti-Patterns to Avoid

- **Creating automated E2E tests for one-time verification:** Automation setup takes longer than manual execution for this phase; save automation for regression testing
- **Testing in dev environment instead of production:** Phase goal is production verification — dev tests don't validate Vercel deployment, Neon database, or Partner Dashboard config
- **Skipping fresh store test:** Testing on an already-configured store misses OAuth and first-install bugs
- **Not documenting exact failure messages:** "It didn't work" blocks debugging; capture console errors, network responses, exact UI state

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Automated E2E testing | Custom Playwright setup | Manual verification for v1.1, defer automation | One-time validation faster manually; automation valuable for regression in v1.2+ |
| Health monitoring | Custom uptime checker | Vercel's built-in health checks | Vercel provides deployment checks, monitoring, and alerting out of box |
| API smoke tests | Custom curl scripts | Manual Postman/curl execution | Quick validation doesn't justify script maintenance |

**Key insight:** Manual testing is the correct tool for production launch verification. Automation pays off when tests run repeatedly; v1.1 is about confirming the one-time deployment works correctly.

## Common Pitfalls

### Pitfall 1: Testing Parts in Isolation Instead of E2E Flow

**What goes wrong:** Testing API separately, widget separately, Draft Orders separately looks thorough but misses integration failures (e.g., API works but widget can't reach it due to CORS; Draft Orders create but with wrong pricing due to unit conversion bug)

**Why it happens:** Easier to test components individually, natural tendency to break down complex tests

**How to avoid:** Structure the primary test as one continuous flow: install → create matrix → API call → widget render → Draft Order creation → Shopify admin verification. Only test components separately if the E2E flow fails and you need to isolate the breakpoint.

**Warning signs:** Test plan has 10 small isolated tests instead of 1-2 full workflow tests

### Pitfall 2: Using Development Store That Already Has the App Installed

**What goes wrong:** Fresh install bugs (OAuth redirect failures, missing database migrations, session setup errors) go undetected because the store already has a working session

**Why it happens:** Convenient to reuse existing dev store, reinstalls feel unnecessary

**How to avoid:** Create a brand new development store or uninstall/reinstall on existing store. The install flow is a critical production validation point — Phase 09 tested OAuth, but Phase 10 should verify it again as part of the complete E2E flow.

**Warning signs:** Test plan says "use pricing-app-3.myshopify.com" (already used in Phase 09)

### Pitfall 3: Not Capturing Exact Environment Details When Tests Pass

**What goes wrong:** Tests pass but you can't reproduce or debug later issues because you didn't document which product ID, which API key, which store URL, which npm package version was tested

**Why it happens:** Focus on failures, assume passing tests don't need documentation

**How to avoid:** In UAT results, document the exact test data: store domain, product GID, matrix ID, API key (masked), widget version, Draft Order ID created. This creates an audit trail and helps future debugging.

**Warning signs:** UAT doc says "tested widget" without version number or "created Draft Order" without capturing the Draft Order ID

### Pitfall 4: Testing Widget with npm link Instead of Published Package

**What goes wrong:** npm link uses symlinks to local code, bypassing the entire publish/install pipeline. Missing files, incorrect package.json exports, or broken TypeScript types won't be caught.

**Why it happens:** npm link is familiar, faster iteration during development

**How to avoid:** For VERIFY-02, use the actual published package: `npm install @gjrkdk/pricing-matrix-widget@0.1.0` in a completely fresh directory outside the monorepo. This tests what external developers will experience.

**Warning signs:** Test plan says "npm link packages/widget" or test project is inside the pricing-app directory

### Pitfall 5: Assuming Production Works Like Development

**What goes wrong:** Development uses ngrok tunnel, localhost PostgreSQL, no CDN, different session storage. Production has Vercel serverless functions, Neon pooling, geographic distribution. Bugs that only appear under production constraints (serverless cold starts, connection pooling limits, CORS from external domains) get missed.

**Why it happens:** Dev and prod "feel" the same during basic testing

**How to avoid:** Test exclusively on production URLs (quote-flow-one.vercel.app), from external networks (not localhost), with real timing (wait for cold start latency). If something works differently than dev, document it — that's valuable learning.

**Warning signs:** Test plan includes localhost URLs or ngrok tunnel references

## Code Examples

No code required for this phase — all testing is manual. However, here are useful verification commands:

### Testing REST API (Price Endpoint)

```bash
# Source: Project architecture from phase 04
curl -X GET \
  'https://quote-flow-one.vercel.app/api/v1/products/gid://shopify/Product/1234567890/price?width=100&height=200&quantity=1' \
  -H 'X-API-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json'

# Expected response (status 200):
{
  "price": 45.00,
  "currency": "EUR",
  "dimensions": { "width": 100, "height": 200, "unit": "cm" },
  "quantity": 1,
  "total": 45.00,
  "matrix": "Glass 6mm",
  "dimensionRange": { "width": "50-500cm", "height": "50-300cm" }
}
```

### Testing REST API (Draft Order Endpoint)

```bash
# Source: Project architecture from phase 03
curl -X POST \
  'https://quote-flow-one.vercel.app/api/v1/draft-orders' \
  -H 'X-API-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "productId": "gid://shopify/Product/1234567890",
    "width": 100,
    "height": 200,
    "quantity": 1
  }'

# Expected response (status 201):
{
  "draftOrderId": "gid://shopify/DraftOrder/9876543210",
  "name": "#D123",
  "checkoutUrl": "https://admin.shopify.com/store/your-store/draft_orders/9876543210",
  "total": "45.00",
  "price": 45.00,
  "dimensions": { "width": 100, "height": 200, "unit": "cm" },
  "quantity": 1
}
```

### Widget External Integration Test HTML

```html
<!-- Source: Widget package README -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Widget Integration Test</title>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import ReactDOM from 'react-dom/client';
    import { PriceMatrixWidget } from '@gjrkdk/pricing-matrix-widget';

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      React.createElement(PriceMatrixWidget, {
        apiUrl: 'https://quote-flow-one.vercel.app',
        apiKey: 'YOUR_API_KEY',
        productId: 'gid://shopify/Product/1234567890'
      })
    );
  </script>
</body>
</html>
```

### npm Package Installation Test

```bash
# Source: Phase 07 npm publishing patterns
# Create completely fresh test directory (outside monorepo)
cd ~ && mkdir widget-integration-test && cd widget-integration-test

# Initialize package.json
npm init -y

# Install published widget (tests actual tarball from npm registry)
npm install @gjrkdk/pricing-matrix-widget@0.1.0 react@18 react-dom@18

# Verify installation
ls node_modules/@gjrkdk/pricing-matrix-widget/
# Expected: dist/, package.json, README.md, LICENSE

# Check TypeScript types exist
ls node_modules/@gjrkdk/pricing-matrix-widget/dist/
# Expected: index.d.ts, price-matrix-widget.es.js, price-matrix-widget.umd.js
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Automated Playwright E2E for production validation | Manual smoke testing with UAT checklists | 2024-2026 | Manual testing recognized as faster for one-time launch verification; automation deferred to post-launch regression testing |
| Production testing via cloned environments | Direct production testing with development stores | Ongoing | Shopify's dev store model enables safe production testing without cloning |
| Pre-deployment verification only | Post-deployment manual smoke tests | CI/CD era | Catching deployment-specific issues (serverless cold starts, CDN behavior) requires testing in actual production environment |

**Current best practices for Shopify app production verification:**
- Use development stores for safe production testing (no real merchant data at risk)
- Test OAuth flow on every deployment to catch redirect URL misconfiguration
- Verify embedded app rendering in Shopify admin (not just standalone)
- Test API endpoints from external networks to validate CORS and authentication
- Validate npm package installations in completely fresh projects (outside monorepo)

**Deprecated/outdated:**
- Testing only in local development (misses serverless, CDN, geographic distribution issues)
- Assuming npm link validates published packages (bypasses the tarball creation and install pipeline)
- Skip testing OAuth on production (Partner Dashboard config can differ from dev)

## Open Questions

1. **Should we test on multiple development stores or one fresh store?**
   - What we know: Phase 09 tested on dynamic-pricing-demo.myshopify.com
   - What's unclear: Whether one store is sufficient or if testing multiple stores catches edge cases
   - Recommendation: One fresh store is sufficient for v1.1 validation. Create "quoteflow-e2e-test.myshopify.com" (or similar) to keep test environments clearly separated.

2. **Should we test widget on multiple browsers?**
   - What we know: Widget uses Shadow DOM and standard Web APIs
   - What's unclear: Whether browser compatibility testing is in scope for v1.1
   - Recommendation: Test on Chrome only for v1.1 (most common developer browser). Document browser compatibility testing as deferred for v1.2.

3. **What happens if tests reveal production bugs?**
   - What we know: All prior phases completed successfully
   - What's unclear: Process for fixing bugs found during E2E verification
   - Recommendation: If bugs are found, document them in UAT with "fail" result, fix them outside the phase workflow (ad-hoc commits), then re-run the test. Keep phase focused on verification, not implementation.

4. **Should we test with real customer data or test data?**
   - What we know: Using development stores with test products
   - What's unclear: Whether to create realistic product data or minimal test data
   - Recommendation: Create one realistic test matrix (e.g., "Glass 6mm" with 3×3 breakpoints, realistic prices) and one test product. This provides sufficient coverage without over-complicating the test setup.

## Sources

### Primary (HIGH confidence)
- Project architecture from .planning/PROJECT.md (Phase 03-06 implementation details)
- Phase 07-09 SUMMARY.md files (deployment and registration verification patterns)
- shopify.dev official docs: [Pass app review](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review) - Shopify's requirements for production testing

### Secondary (MEDIUM confidence)
- [Shopify User Testing Your App](https://www.shopify.com/partners/blog/user-test-app) - Partner guidance on testing apps before launch
- [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks) - Post-deployment verification features
- [npm pack for local testing](https://dev.to/scooperdev/use-npm-pack-to-test-your-packages-locally-486e) - Package validation patterns
- [Production Readiness Checklist 2026](https://vettedoutsource.com/blog/production-readiness-checklist/) - General production verification practices
- [Manual Smoke Testing Guide](https://www.globalapptesting.com/blog/smoke-testing-in-production) - Best practices for manual production testing

### Tertiary (LOW confidence)
- Various WebSearch results on E2E testing — general patterns verified against Shopify-specific documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Manual testing requires no libraries, patterns established from Phase 09
- Architecture: HIGH - Test plan structure follows proven Phase 09 manual verification pattern
- Pitfalls: HIGH - Based on documented issues from Phase 07-09 execution and general production testing experience

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days) - Manual testing practices are stable; Shopify Partner Dashboard requirements may change but are well-documented
