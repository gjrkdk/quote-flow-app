# Phase 09: Shopify Partner Dashboard Registration - Research

**Researched:** 2026-02-08
**Domain:** Shopify Partner Dashboard app distribution and OAuth configuration
**Confidence:** HIGH

## Summary

Phase 09 requires registering the production Shopify app (QuoteFlow) in the Partner Dashboard so merchants can install it via direct link. The app already exists in Partner Dashboard with correct OAuth URLs (created in Phase 08), but needs distribution configuration and testing of the end-to-end OAuth install flow.

Shopify offers three distribution methods: **Public** (App Store), **Custom** (direct install link for specific merchants), and **Shopify Admin** (single store). For this phase, the app will use **Public distribution** (targeting App Store submission) but can be tested on development stores before App Store listing is created.

The key technical components are: (1) selecting distribution method in Partner Dashboard (irreversible choice), (2) running `shopify app deploy` to create an app version and release it, (3) testing OAuth install flow on a development store, and (4) verifying the embedded dashboard loads correctly post-install.

**Primary recommendation:** Select Public distribution, deploy production configuration using `shopify app deploy --config shopify.app.production.toml`, test installation on a development store, then verify OAuth redirect and embedded dashboard work end-to-end.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Shopify CLI | 3.58.0+ | Deploy app configuration to Partner Dashboard | Official Shopify tooling for app deployment |
| @shopify/shopify-app-remix | 2.7.0+ | Shopify Remix app framework with OAuth and token exchange | Official Shopify Remix adapter with embedded auth |
| @shopify/app-bridge-react | 4.1.2+ | App Bridge integration for embedded apps | Required for session tokens and embedded navigation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @shopify/shopify-app-session-storage-postgresql | 3.0.0+ | PostgreSQL session storage | Already in use; stores OAuth sessions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Public distribution | Custom distribution | Custom apps can't use Billing API or App Store; suitable only for single-client apps |
| Shopify CLI deploy | Dev Dashboard manual config | CLI version control is reproducible; Dashboard is manual and error-prone |

**Installation:**
```bash
# Already installed in project
npm install @shopify/app@^3.58.0
```

## Architecture Patterns

### Recommended Project Structure
```
.planning/phases/09-shopify-partner-dashboard-registration/
├── 09-RESEARCH.md         # This document
├── 09-01-PLAN.md          # Distribution selection and deployment
└── 09-01-SUMMARY.md       # Execution summary
```

### Pattern 1: Distribution Method Selection (Partner Dashboard)

**What:** Selecting the app distribution method determines how merchants can install the app. This choice is **permanent and cannot be changed** after selection.

**When to use:** Before first production deployment and testing.

**Steps:**
1. Navigate to Partner Dashboard → Apps → [Your App] → Distribution
2. Click "Choose distribution"
3. Select "Public" for App Store-bound apps
4. Confirm selection (irreversible)

**Source:** [Shopify Distribution Method Selection](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method)

### Pattern 2: App Configuration Deployment

**What:** The `shopify app deploy` command syncs `shopify.app.toml` configuration to Partner Dashboard, creating an app version (snapshot of config + extensions) and releasing it to installed merchants.

**When to use:** After any changes to scopes, webhooks, URLs, or embedded settings in the TOML file.

**Example:**
```bash
# Deploy production configuration
shopify app deploy --config shopify.app.production.toml --allow-updates

# Creates app version and releases to production
# Changes applied to all stores with app installed
```

**Source:** [Shopify CLI app deploy](https://shopify.dev/docs/api/shopify-cli/app/app-deploy)

### Pattern 3: Token Exchange for Embedded Apps (Already Implemented)

**What:** Modern OAuth flow where embedded apps exchange session tokens for access tokens without redirect loops. Enabled via `unstable_newEmbeddedAuthStrategy` future flag.

**Current implementation:**
```typescript
// app/shopify.server.ts (existing code)
const shopify = shopifyApp({
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true, // ✓ Already enabled
  },
});
```

**Source:** [Shopify Token Exchange](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange)

### Pattern 4: OAuth Install Flow

**What:** When a merchant installs the app, Shopify redirects to the app's `application_url` with query params (`shop`, `hmac`, `timestamp`, `host`). The Remix auth route (`/auth/*`) handles OAuth negotiation.

**Flow:**
1. Merchant clicks "Install app" (from Dev Dashboard or direct link)
2. Shopify redirects to `https://quote-flow-one.vercel.app?shop=store.myshopify.com&...`
3. App redirects to Shopify OAuth authorization screen
4. Merchant approves scopes
5. Shopify redirects to `https://quote-flow-one.vercel.app/auth/callback`
6. App exchanges auth code for access token (or uses token exchange)
7. App stores session in PostgreSQL
8. Merchant lands on embedded dashboard

**Source:** [Shopify OAuth Getting Started](https://shopify.dev/docs/apps/auth/oauth/getting-started)

### Pattern 5: Testing on Development Stores

**What:** Before App Store submission, apps can be tested by installing them on Partner account development stores.

**Steps:**
1. Create development store (Partner Dashboard → Stores → Add store → Development store)
2. Navigate to Partner Dashboard → Apps → [Your App] → Home
3. Click "Install app" under Installs section
4. Select development store from dropdown
5. App installs and redirects to embedded dashboard

**Note:** Development stores are free, have no time restrictions, and mirror Advanced Shopify plan functionality.

**Source:** [Shopify Development Stores](https://www.shopify.com/partners/blog/development-stores)

### Anti-Patterns to Avoid

- **Changing distribution method after selection:** Distribution method is permanent. Research requirements thoroughly before choosing.
- **Defining webhooks in both TOML and shopifyApp():** This causes conflicts. Use TOML only (already done correctly in this project).
- **Using `shopify app build` on Vercel:** Shopify CLI binary isn't available. Use `remix vite:build` directly (already resolved in Phase 08).
- **Manually configuring URLs in Partner Dashboard:** Always use `shopify app deploy` to sync TOML config. Manual changes can be overwritten.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flow implementation | Custom OAuth redirect handling | `authenticate.admin(request)` from @shopify/shopify-app-remix | Handles authorization code grant, token exchange, session storage, and token refresh |
| Session token validation | Manual JWT parsing and verification | `authenticate` middleware | Validates HMAC, shop domain, timestamp, and session expiry |
| App Bridge setup | Manual AppProvider configuration | `@shopify/app-bridge-react` + Remix loaders | Handles session token generation, authenticated fetch, and navigation |
| Webhook registration | Manual API calls to register webhooks | `shopify.registerWebhooks({ session })` in afterAuth hook | Automatically registers webhooks defined in TOML |

**Key insight:** Shopify provides battle-tested libraries for embedded app authentication. Custom implementations miss edge cases (token refresh, session expiry, CSRF protection, multi-tab sync) that the official libraries handle.

## Common Pitfalls

### Pitfall 1: Selecting Wrong Distribution Method

**What goes wrong:** Developer selects "Custom distribution" thinking they can change to Public later. Distribution method is permanent and cannot be changed.

**Why it happens:** The Partner Dashboard UI doesn't emphasize the irreversibility of the choice prominently enough.

**How to avoid:** Understand distribution method capabilities before selection:
- **Public:** Can install on any store, can list in App Store, supports Billing API
- **Custom:** Direct link only, one store or Plus organization stores, no Billing API
- **Shopify Admin:** Single store, no extensions, no embedding

**Warning signs:** If you're planning App Store submission, you MUST choose Public. Custom apps cannot be upgraded to Public later.

**Source:** [Distribution Method Selection](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method)

### Pitfall 2: Forgetting to Run `shopify app deploy`

**What goes wrong:** Developer updates `shopify.app.production.toml` locally but doesn't deploy. Changes don't sync to Partner Dashboard. OAuth redirects fail, webhooks don't register, or scopes aren't updated.

**Why it happens:** During development, `shopify app dev` auto-syncs config. Developers assume production works the same way.

**How to avoid:** After any TOML changes (URLs, scopes, webhooks), run:
```bash
shopify app deploy --config shopify.app.production.toml
```

**Warning signs:** Partner Dashboard shows outdated config, merchants see OAuth errors, webhooks aren't firing.

**Source:** [App Configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)

### Pitfall 3: Testing Only on Dev Store, Not Fresh Install

**What goes wrong:** Developer tests by re-installing on the same dev store repeatedly. OAuth flow works but doesn't catch cold-start issues (missing session, invalid redirect URL, expired tokens).

**Why it happens:** Re-installs reuse existing sessions and database state.

**How to avoid:** Test on a **fresh development store** that has never had the app installed:
1. Create new dev store
2. Install app for first time
3. Verify OAuth redirect works
4. Verify embedded dashboard loads
5. Test uninstall + reinstall flow

**Warning signs:** App works on dev store but fails on merchant installs in production.

### Pitfall 4: Not Verifying OAuth Redirect URLs Match Exactly

**What goes wrong:** TOML file has `https://quote-flow-one.vercel.app/auth/callback` but Partner Dashboard config (from old deploy) has `https://old-url.vercel.app/auth/callback`. OAuth fails with redirect_uri mismatch error.

**Why it happens:** Developer deploys to new Vercel URL but forgets to update production TOML and redeploy.

**How to avoid:** After deploying web app to new URL:
1. Update `application_url` and `redirect_urls` in TOML
2. Run `shopify app deploy --config shopify.app.production.toml`
3. Verify Partner Dashboard shows new URLs

**Warning signs:** OAuth error: "The redirect_uri is not whitelisted"

### Pitfall 5: Using Development Store URL in Production TOML

**What goes wrong:** Developer copies dev store URL (e.g., `dev_store_url = "pricing-app-3.myshopify.com"`) into production TOML thinking it's required. `shopify app deploy` fails or applies wrong configuration.

**Why it happens:** Confusion between `dev_store_url` (for local dev only) and production configuration.

**How to avoid:** In `shopify.app.production.toml`:
- **Remove** `automatically_update_urls_on_dev = true` (dev-only setting)
- **Keep** `dev_store_url` for reference but don't rely on it
- Production config uses `application_url` and `redirect_urls` only

**Warning signs:** Deploy command prompts for unexpected dev store selection, or config changes don't apply.

## Code Examples

Verified patterns from official sources:

### Example 1: Selecting Distribution Method (Partner Dashboard UI)

```text
Partner Dashboard → Apps → [Your App] → Distribution

┌─────────────────────────────────────────────────────┐
│  Choose distribution method                         │
│                                                     │
│  ○ Public                                           │
│    Distribute to many merchants via App Store      │
│    • Requires app review before listing            │
│    • Supports Billing API                          │
│    • Can install on any Shopify store              │
│                                                     │
│  ○ Custom                                           │
│    Distribute via direct link                      │
│    • One store or Plus organization only           │
│    • No Billing API                                │
│    • No App Store review required                  │
│                                                     │
│  [Select]                                           │
└─────────────────────────────────────────────────────┘

⚠️ You cannot change distribution method after selection
```

**Source:** [Distribution Selection](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method)

### Example 2: Deploying Production Configuration

```bash
# Deploy production app configuration
shopify app deploy --config shopify.app.production.toml --allow-updates

# Expected output:
# ✓ Reading app configuration from shopify.app.production.toml
# ✓ Building app...
# ✓ Deploying app to Shopify...
# ✓ Creating app version 1.0.0
# ✓ Releasing version to production
#
# App URL: https://quote-flow-one.vercel.app
# Scopes: write_draft_orders, read_products, write_products
# Webhooks: app/uninstalled
# Redirect URLs: https://quote-flow-one.vercel.app/auth/callback
```

**Flags:**
- `--config <file>`: Use specific TOML configuration
- `--allow-updates`: Skip confirmation for extension updates (recommended for CI/CD)
- `--force`: Deploy without any confirmation (use with caution)
- `--no-release`: Create version without releasing to merchants

**Source:** [Shopify CLI app deploy](https://shopify.dev/docs/api/shopify-cli/app/app-deploy)

### Example 3: Testing Installation on Development Store

```text
Partner Dashboard → Apps → QuoteFlow → Home

┌─────────────────────────────────────────────────────┐
│  Test your app                                      │
│                                                     │
│  Installs                                           │
│  ┌───────────────────────────────────────────────┐ │
│  │ Development stores                            │ │
│  │ Install app on:  [Select store ▼]            │ │
│  │ [Install app]                                 │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

After clicking Install:
1. Redirects to OAuth screen
2. Merchant approves scopes
3. Redirects to embedded dashboard in Shopify admin
```

**Source:** [Development Stores](https://www.shopify.com/partners/blog/development-stores)

### Example 4: Verifying OAuth Flow (Remix Loader)

```typescript
// app/routes/app._index.tsx (existing pattern in project)
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // If we reach here, OAuth succeeded and session is valid
  console.log("Authenticated shop:", session.shop);
  console.log("Access token:", session.accessToken);

  return json({ shop: session.shop });
};
```

**What happens:**
- `authenticate.admin(request)` checks for valid session
- If no session: redirects to OAuth flow
- If session exists but expired: refreshes token (or uses token exchange)
- If session valid: returns admin client and session object

**Source:** [Shopify Remix Authentication](https://shopify.dev/docs/api/shopify-app-remix/latest)

### Example 5: Current Production TOML (Phase 08 Output)

```toml
# shopify.app.production.toml (current state)
client_id = "d78dd3e635d5cb58866d9d38de855675"
name = "QuoteFlow"
application_url = "https://quote-flow-one.vercel.app"
embedded = true

[build]
dev_store_url = "pricing-app-3.myshopify.com"

[webhooks]
api_version = "2026-01"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "/webhooks"

[access_scopes]
scopes = "write_draft_orders,read_products,write_products"
optional_scopes = [ ]
use_legacy_install_flow = false

[auth]
redirect_urls = [
  "https://quote-flow-one.vercel.app/auth/callback"
]

[pos]
embedded = false
```

**Key fields for Phase 09:**
- `application_url`: Where Shopify redirects during install
- `redirect_urls`: OAuth callback URLs (must match exactly)
- `scopes`: Permissions requested during install
- `use_legacy_install_flow = false`: Uses Shopify-managed installation + token exchange

**Source:** [App Configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Authorization code grant for embedded apps | Token exchange with session tokens | 2024 (stable 2026) | Faster install, no redirect loops, better UX |
| Manual Partner Dashboard config | CLI-driven TOML deployment | 2023 | Reproducible config, version control, CI/CD friendly |
| Private apps | Custom apps via Dev Dashboard | Jan 1, 2026 | Unified app creation process, better tooling |
| `shopify app config push` | `shopify app deploy` | 2024 | Bundles config + extensions in single command |

**Deprecated/outdated:**
- **Authorization code grant for embedded apps:** Still works but token exchange is now preferred for embedded apps (faster, fewer redirects). Project already uses `unstable_newEmbeddedAuthStrategy: true`.
- **Manual webhook registration:** Register webhooks in TOML, not in `shopifyApp()` config. Project already does this correctly.
- **Creating apps directly from Admin:** As of Jan 1, 2026, all new apps must be created via Dev Dashboard or CLI.

**Sources:**
- [Token Exchange](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange)
- [Shopify-Managed Installation](https://shopify.dev/docs/apps/build/authentication-authorization/app-installation)
- [2026 Custom App Changes](https://datronixtech.com/shopify-custom-app-deprecation/)

## Open Questions

### 1. Does the app need distribution selected before `shopify app deploy` works?

**What we know:** Phase 08 created the production Shopify app and deployed config without selecting distribution. Plan 08-02 mentions user manually configured URLs in Partner Dashboard.

**What's unclear:** Whether `shopify app deploy` requires distribution to be selected first, or if it works before distribution selection.

**Recommendation:** Assume distribution selection is required before deploy. If deploy works without it, that's a bonus. Test by running deploy first; if it fails, select distribution then redeploy.

### 2. Is the current `shopify.app.production.toml` already deployed to Partner Dashboard?

**What we know:** Phase 08 Plan 02 Task 2 mentioned running `shopify app deploy --config shopify.app.production.toml`. Summary shows production TOML was updated with real values.

**What's unclear:** Whether the deploy command was actually executed, or if user manually configured Partner Dashboard instead.

**Recommendation:** Verify Partner Dashboard config matches TOML. If not, run deploy. If it matches, deployment already happened and testing can begin.

### 3. What URL do merchants use to install the app before App Store listing exists?

**What we know:** Public apps can be tested on development stores before App Store listing is created. Partner Dashboard shows "Install app" button under Installs section.

**What's unclear:** Whether there's a shareable install link for testing on non-dev-store merchants, or if testing is limited to dev stores until App Store listing is live.

**Recommendation:** Test on dev stores first. If merchant testing is needed pre-listing, check Partner Dashboard for "Test installation" or "Share install link" option. Public apps may not have direct install links until listing is submitted.

**Mitigation:** Phase requirement is "installable via direct link" but context says App Store is the goal. Interpret "direct link" as "Partner Dashboard Install app button" for dev store testing. App Store listing (with public install) comes in a future phase.

## Sources

### Primary (HIGH confidence)

**Official Shopify Documentation:**
- [App Configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration) - TOML file structure
- [Shopify CLI app deploy](https://shopify.dev/docs/api/shopify-cli/app/app-deploy) - Deploy command reference
- [Distribution Method Selection](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method) - Choosing distribution type
- [About App Distribution](https://shopify.dev/docs/apps/launch/distribution) - Distribution overview
- [Shopify-Managed Installation](https://shopify.dev/docs/apps/build/authentication-authorization/app-installation) - Modern install flow
- [Token Exchange](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange) - Embedded app auth
- [OAuth Getting Started](https://shopify.dev/docs/apps/auth/oauth/getting-started) - OAuth flow basics
- [App Versions](https://shopify.dev/docs/apps/launch/deployment/app-versions) - Version management
- [About Deployment](https://shopify.dev/docs/apps/launch/deployment) - Deployment overview

**Shopify API Documentation:**
- [Shopify App Remix API](https://shopify.dev/docs/api/shopify-app-remix/latest) - Remix authentication
- [Future Flags](https://shopify.dev/docs/api/shopify-app-remix/v2/guide-future-flags) - unstable_newEmbeddedAuthStrategy

### Secondary (MEDIUM confidence)

**Community and Verified Sources:**
- [Development Stores Guide](https://www.shopify.com/partners/blog/development-stores) - Testing best practices
- [Shopify 2026 Custom App Changes](https://datronixtech.com/shopify-custom-app-deprecation/) - Jan 2026 deprecations
- [App Store Review Process](https://shopify.dev/docs/apps/launch/app-store-review/review-process) - Review requirements
- [Pass App Review](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review) - Review preparation

### Tertiary (LOW confidence)

**Community Forums (informational only):**
- Shopify Developer Community threads on OAuth flows, distribution methods, and deployment issues (used for understanding common pain points, not as authoritative source)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using official Shopify libraries already in project
- Architecture: HIGH - Official Shopify docs, verified with Phase 08 implementation
- Pitfalls: MEDIUM-HIGH - Based on official docs + community forum patterns

**Research date:** 2026-02-08
**Valid until:** 2026-05-08 (90 days - Shopify API stable, deprecation timeline known)

**Key dependencies:**
- Phase 08 completion (production deployment exists)
- Shopify Partner Dashboard access
- Development store for testing

**Risk areas:**
- Distribution method is irreversible - must choose correctly
- OAuth redirect URL mismatches cause hard-to-debug failures
- Token exchange vs authorization code grant confusion (already resolved in codebase)
