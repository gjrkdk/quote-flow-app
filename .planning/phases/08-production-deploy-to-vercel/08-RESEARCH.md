# Phase 08: Production Deploy to Vercel - Research

**Researched:** 2026-02-08
**Domain:** Vercel deployment for Shopify Remix apps with Neon PostgreSQL
**Confidence:** HIGH

## Summary

Deploying a Shopify Remix app to Vercel requires three main components: (1) installing and configuring the `@vercel/remix` package with the Vercel Vite preset, (2) provisioning a Neon PostgreSQL database with both pooled and direct connection strings, and (3) creating a production Shopify app in the Partner Dashboard with updated OAuth URLs. Vercel's zero-configuration deployment for Remix eliminates the need for custom `vercel.json` files when using the recommended Vite preset. Neon's connection pooling via PgBouncer is essential for serverless environments to avoid hitting connection limits during traffic spikes. The build process must run `prisma generate` and `prisma migrate deploy` before `remix vite:build` to ensure the database schema is current.

**Primary recommendation:** Use the `@vercel/remix` package with the Vercel Vite preset for zero-config deployment. Configure Neon with pooled connections for runtime (`DATABASE_URL`) and direct connections for migrations (`DIRECT_URL`). Keep local dev setup (ngrok) working alongside production by maintaining separate `shopify.app.toml` configurations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Database provisioning:**
- Use Neon directly (not Vercel Postgres wrapper) for managed PostgreSQL
- Two environments: local Docker (dev) and Neon (production) — no preview/staging database
- Migrations run as part of Vercel's build step (`prisma migrate deploy` in build command)
- Production database starts empty — no seed data

**Vercel configuration:**
- Use default Vercel subdomain (*.vercel.app) — no custom domain
- Environment variables managed via Vercel dashboard (DATABASE_URL, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES)
- Vercel adapter for Remix needs to be set up (@vercel/remix + vercel.json) — not yet configured
- Vercel account already exists

**Shopify app URL transition:**
- Production app coexists alongside local dev setup (ngrok stays for local development)
- Same dev store (pricing-app-3.myshopify.com) used for both environments — app data lives in separate databases, no conflict
- Production app needs its own API credentials — include step-by-step Partner Dashboard guide as a manual step in the plan
- Widget keeps current behavior: apiBaseUrl is configurable via prop, no default change

**Deploy workflow:**
- Auto-deploy on push to main branch (Vercel's default behavior)
- Preview deployments enabled for non-main branches
- No CI/CD gate — direct deploy to production on push
- GitHub repo is public

### Claude's Discretion

- Exact Vercel adapter configuration and vercel.json structure
- Build command composition (prisma generate + migrate + remix build)
- Any necessary Remix/Vite config changes for Vercel compatibility
- Error page handling in production

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @vercel/remix | 2.16.7 | Vercel integration for Remix | Official Vercel adapter providing serverless function support, streaming, and optimized deployment |
| Neon PostgreSQL | N/A (managed) | Serverless PostgreSQL | Fully managed, auto-scaling PostgreSQL with generous free tier, PgBouncer connection pooling, and instant cold-start handling |
| Prisma | 5.8.0 (current) | Database ORM | Already in use; supports both pooled and direct connections via separate URLs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vercel/analytics | Latest | User tracking | Optional - for monitoring page views and visitor demographics |
| @vercel/functions | 1.3.0 (current) | Extended function utilities | Already installed; provides Vercel-specific types |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Neon | Vercel Postgres | Vercel Postgres is a wrapper around Neon; user chose direct Neon for transparency and control |
| @vercel/remix | Custom server.js | Custom servers not supported with Remix Vite plugin; adds complexity without benefit |
| PgBouncer pooling | Direct connections | Direct connections hit max_connections limit (104-4000 depending on compute size) during traffic spikes |

**Installation:**
```bash
npm install @vercel/remix
```

## Architecture Patterns

### Recommended Project Structure

```
.
├── app/                       # Remix routes and server code
│   ├── routes/                # Auto-deployed as Vercel Functions
│   ├── shopify.server.ts      # Shopify config (reads env vars)
│   └── entry.server.tsx       # Optional: custom server entry (use @vercel/remix handleRequest)
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Migration files (deployed via build command)
├── vite.config.ts             # MUST include vercelPreset()
├── shopify.app.toml           # Development config (ngrok URLs)
├── shopify.app.production.toml # Production config (Vercel URLs) [NEW]
└── .env.example               # Template for required vars
```

### Pattern 1: Vercel Vite Preset Configuration

**What:** Configure Remix Vite plugin with Vercel's preset to enable serverless deployment
**When to use:** Always when deploying Remix to Vercel (highly recommended by Vercel)

**Example:**
```typescript
// Source: https://vercel.com/docs/frameworks/remix
import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { vercelPreset } from '@vercel/remix/vite';

export default defineConfig({
  plugins: [
    remix({
      presets: [vercelPreset()],
      ignoredRouteFiles: ["**/.*"],
    }),
    tsconfigPaths(),
  ],
  // Existing server config stays unchanged
  server: {
    port: Number(process.env.PORT || 3000),
    allowedHosts: [process.env.TUNNEL_DOMAIN ?? "localhost"],
  },
});
```

### Pattern 2: Neon Dual Connection String Setup

**What:** Use pooled connection for app runtime, direct connection for Prisma CLI operations
**When to use:** Always with Neon + Prisma in serverless environments

**Example:**
```bash
# Source: https://neon.com/docs/guides/prisma
# .env (Vercel environment variables)

# Pooled connection (for app runtime) - includes "-pooler" in hostname
DATABASE_URL="postgresql://user:pass@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require&connect_timeout=15"

# Direct connection (for Prisma CLI migrations)
DIRECT_URL="postgresql://user:pass@ep-cool-darkness-123456.us-east-2.aws.neon.tech/dbname?sslmode=require"
```

**Critical:** Add `connect_timeout=15` to `DATABASE_URL` to handle Neon's compute scale-to-zero (cold start takes 500ms-2s).

### Pattern 3: Build Command with Prisma

**What:** Run Prisma codegen and migrations before building Remix app
**When to use:** Always when deploying Prisma-based apps to Vercel

**Example:**
```json
// Source: https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel
// package.json
{
  "scripts": {
    "build": "shopify app build",
    "vercel-build": "prisma generate && prisma migrate deploy && npm run build"
  }
}
```

**Vercel dashboard Build Command:** `npm run vercel-build`

**Why:** Vercel caches dependencies, so `postinstall` hooks don't run on re-deploys. Explicit `prisma generate` ensures fresh client. `migrate deploy` applies pending migrations before app starts.

### Pattern 4: Environment-Specific Shopify App Config

**What:** Maintain separate TOML files for development and production app configurations
**When to use:** When the same codebase needs to run on both ngrok (dev) and Vercel (prod)

**Example:**
```toml
# shopify.app.toml (development)
client_id = "dev-client-id-123"
application_url = "https://fagaceous-rana-carbolated.ngrok-free.dev"
[auth]
redirect_urls = ["https://fagaceous-rana-carbolated.ngrok-free.dev/auth/callback"]

# shopify.app.production.toml (production)
client_id = "prod-client-id-456"
application_url = "https://your-app.vercel.app"
[auth]
redirect_urls = ["https://your-app.vercel.app/auth/callback"]
```

**Deploy with:** `shopify app deploy --config shopify.app.production.toml`

### Pattern 5: Import from @vercel/remix for Utilities

**What:** Replace imports from `@remix-run/node` with `@vercel/remix` for Vercel-specific optimizations
**When to use:** Always when using utilities like `json`, `defer`, `createCookie` on Vercel

**Example:**
```typescript
// Source: https://vercel.com/docs/frameworks/remix
// ❌ Old (standard Remix)
import { json, defer } from '@remix-run/node';

// ✅ New (Vercel-optimized)
import { json, defer } from '@vercel/remix';
```

**Why:** Vercel's utilities enable streaming, better serverless integration, and bypass response size limits.

### Anti-Patterns to Avoid

- **Custom server.js file:** Not supported with Remix Vite plugin; Vercel auto-generates serverless entry
- **Shared DATABASE_URL for preview and production:** Preview deployments will write to production database (user chose no preview DB, but pattern documented for awareness)
- **Using direct Neon connection at runtime:** Bypasses PgBouncer pooling; hits 104-4000 connection limit under load
- **Missing `connect_timeout` parameter:** Cold-start connections timeout with Neon's default 5s limit
- **Running migrations via `prisma migrate dev` in production:** Use `prisma migrate deploy` (non-interactive, CI-friendly)
- **Hardcoding `SHOPIFY_APP_URL` in code:** Always read from `process.env.SHOPIFY_APP_URL` for environment portability

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Serverless function routing | Custom Express/Fastify server | Vercel's auto-routing from `app/routes` | Remix routes auto-deploy as functions; manual routing breaks Vercel's optimization |
| Connection pooling | Manual pool management (pg.Pool) | Neon's built-in PgBouncer (`-pooler` URL) | PgBouncer handles 10,000 concurrent connections with transaction mode; custom pools add latency |
| Database migrations | SQL scripts in build step | Prisma Migrate (`prisma migrate deploy`) | Tracks migration state, handles failures, supports rollback, integrates with Prisma schema |
| OAuth redirect logic | Custom redirect handlers | `@shopify/shopify-app-remix` built-in auth | Handles embedded app iframe escaping, session token validation, multi-store auth |
| Environment detection | Manual NODE_ENV checks | Vercel system env vars (`VERCEL_ENV`, `VERCEL_URL`) | Auto-injected by Vercel; distinguishes production/preview/development reliably |

**Key insight:** Vercel's serverless infrastructure requires zero-config when using official adapters. Custom solutions bypass optimizations (function splitting, edge caching, streaming) and introduce cold-start overhead.

## Common Pitfalls

### Pitfall 1: Prisma Client Not Generated on Deploy

**What goes wrong:** Build succeeds but runtime crashes with "Cannot find module '@prisma/client'" or "Prisma Client is outdated"

**Why it happens:** Vercel caches `node_modules` between deploys. `postinstall` hooks don't re-run, leaving stale generated client.

**How to avoid:**
- Add explicit `prisma generate` to build command: `"vercel-build": "prisma generate && ..."`
- OR move `prisma` from `devDependencies` to `dependencies` (enables `postinstall` to run)

**Warning signs:** Error logs mentioning "Invalid `prisma.X.findMany()` invocation" or "@prisma/client/runtime not found"

**Source:** [Prisma Vercel deployment docs](https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel)

### Pitfall 2: Neon Connection Timeouts on Cold Start

**What goes wrong:** First request after inactivity returns "Can't reach database server" or P1001 error

**Why it happens:** Neon scales compute to zero after 5 minutes of inactivity. Wake-up takes 500ms-2s, but Prisma's default connection timeout is 5s. Under latency, timeout expires before compute wakes.

**How to avoid:**
- Add `connect_timeout=15` to `DATABASE_URL` query string
- Use pooled connection (`-pooler` hostname) for faster connection reuse
- Consider retry logic with exponential backoff for critical operations

**Warning signs:** Error code P1001, "connection timed out", failures after periods of inactivity

**Source:** [Neon connection latency docs](https://neon.com/docs/connect/connection-latency)

### Pitfall 3: OAuth Redirect URL Mismatch

**What goes wrong:** After Vercel deployment, Shopify OAuth returns "redirect_uri and application URL must have matching hosts"

**Why it happens:** `shopify.app.toml` still points to ngrok URLs. Shopify rejects redirect if URLs don't match registered app configuration.

**How to avoid:**
- Create separate `shopify.app.production.toml` with Vercel URLs
- Update `application_url` and `redirect_urls` to match Vercel deployment
- Run `shopify app deploy --config shopify.app.production.toml` to update Partner Dashboard
- Keep original `shopify.app.toml` for local development

**Warning signs:** OAuth flow redirects to ngrok, error message about host mismatch

**Source:** [Shopify deployment guide](https://shopify.dev/docs/apps/launch/deployment/deploy-to-hosting-service)

### Pitfall 4: Missing SHOPIFY_APP_URL Environment Variable

**What goes wrong:** App installs fail with "Invalid app URL" or webhook registration fails silently

**Why it happens:** `app/shopify.server.ts` reads `process.env.SHOPIFY_APP_URL` for OAuth redirect construction. Empty string breaks auth flow.

**How to avoid:**
- Set `SHOPIFY_APP_URL` in Vercel dashboard (Project Settings → Environment Variables)
- Value must match Vercel deployment URL: `https://your-app.vercel.app` (no trailing slash)
- Set for both Production and Preview environments (or Preview fails)
- Verify with test deployment before updating Partner Dashboard

**Warning signs:** Empty redirect URLs in logs, authentication errors, webhooks not received

**Source:** [Shopify app config docs](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)

### Pitfall 5: Preview Deployments Using Production Database

**What goes wrong:** Preview branch deploys modify production data, breaking live app or tests

**Why it happens:** Vercel injects same `DATABASE_URL` for all environments unless explicitly scoped. Preview deployments run migrations against production.

**How to avoid:**
- User decision: NO preview database (preview deploys disabled or manually tested)
- If enabling previews: create second Neon database, set `DATABASE_URL` scoped to "Preview" environment in Vercel
- Or use Neon branching feature (creates ephemeral DB per preview)

**Warning signs:** Production data changes during PR testing, migration conflicts

**Source:** [Vercel environment variables](https://vercel.com/docs/environment-variables)

### Pitfall 6: Missing Vercel Preset Causes 404s

**What goes wrong:** Deployed app returns 404 for all routes except index. Assets load but navigation fails.

**Why it happens:** Without `vercelPreset()` in `vite.config.ts`, Vercel treats deployment as static files. Server-side routes don't register as functions.

**How to avoid:**
- Add `vercelPreset()` to Remix plugin `presets` array in `vite.config.ts`
- Verify build output shows "✓ Serverless Function created" (not just static files)
- Test a non-index route (e.g., `/app/admin`) immediately after deploy

**Warning signs:** Build succeeds but routes return 404, `_server` directory missing from `.vercel/output`

**Source:** [Vercel Remix integration](https://vercel.com/blog/vercel-remix-integration-with-edge-functions-support)

### Pitfall 7: Node.js 18 Deprecated

**What goes wrong:** New deployments fail with "Node.js 18 is no longer supported" error

**Why it happens:** Vercel deprecated Node.js 18 on September 1, 2025. Apps with `"engines": { "node": ">=18.0.0" }` in `package.json` default to 18.

**How to avoid:**
- Update `package.json` to `"engines": { "node": ">=20.0.0" }`
- Or set Node.js version to 20.x in Vercel Project Settings → General → Node.js Version
- Verify locally with `node -v` before deploying

**Warning signs:** Build error mentioning Node.js 18, `FUNCTION_INVOCATION_FAILED` errors

**Source:** [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## Code Examples

Verified patterns from official sources:

### Creating Production Shopify App (Partner Dashboard)

**Manual steps (cannot be automated):**

1. **Log into Partner Dashboard:** https://partners.shopify.com/
2. **Navigate to Apps:** Click "Apps" in left sidebar
3. **Create App:**
   - Click "Create app" button
   - Select "Create app manually" (not "Use a template")
   - **App name:** Dynamic Pricing Production (or your choice)
   - Click "Create app"
4. **Copy API Credentials:**
   - In app overview, scroll to "Client credentials" section
   - Copy **Client ID** → save as `SHOPIFY_API_KEY` env var
   - Click "Reveal" next to Client secret → copy → save as `SHOPIFY_API_SECRET`
   - **IMPORTANT:** You can only view the secret once. Store securely (password manager).
5. **Configure App URLs:**
   - Navigate to "Configuration" tab in left sidebar
   - Scroll to "App URL" section
   - **App URL:** `https://your-app.vercel.app` (replace with actual Vercel URL)
   - **Allowed redirection URL(s):** `https://your-app.vercel.app/auth/callback`
   - Click "Save"
6. **Set Scopes:**
   - In "Configuration" → "Access scopes" section
   - Check boxes for:
     - `write_draft_orders`
     - `read_products`
     - `write_products`
   - Click "Save"
7. **Configure Webhooks:**
   - In "Configuration" → "Webhooks" section
   - **API version:** 2026-01
   - Add subscriptions:
     - `app/uninstalled` → `https://your-app.vercel.app/webhooks`
     - `customers/data_request` → `https://your-app.vercel.app/webhooks`
     - `customers/redact` → `https://your-app.vercel.app/webhooks`
     - `shop/redact` → `https://your-app.vercel.app/webhooks`
   - Click "Save"
8. **Enable Embedded App:**
   - In "Configuration" → "Embedded app" section
   - Toggle "Embedded in Shopify admin" → ON
   - Click "Save"

**Output:** Client ID (SHOPIFY_API_KEY) and Client secret (SHOPIFY_API_SECRET) ready for Vercel env vars.

**Source:** [Shopify Partner Dashboard](https://partners.shopify.com/) + [Shopify deployment guide](https://shopify.dev/docs/apps/launch/deployment/deploy-to-hosting-service)

### Neon Database Setup

```bash
# 1. Create Neon account and project at https://neon.tech/
# 2. Create database:
#    - Project name: pricing-app-production
#    - Region: US East (closest to Vercel us-east-1)
#    - Compute size: Free tier (0.25 CU, 104 connections)
# 3. Copy connection strings from Neon dashboard:

# Pooled connection (for runtime - note "-pooler" in hostname)
DATABASE_URL="postgresql://neondb_owner:password@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"

# Direct connection (for migrations - no "-pooler")
DIRECT_URL="postgresql://neondb_owner:password@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

# 4. Add to Vercel environment variables:
#    Project Settings → Environment Variables → Add
#    - Name: DATABASE_URL, Value: <pooled URL>, Environments: Production, Preview
#    - Name: DIRECT_URL, Value: <direct URL>, Environments: Production, Preview
```

**Source:** [Neon Prisma guide](https://neon.com/docs/guides/prisma)

### Vercel Environment Variables Setup

```bash
# Required environment variables for Vercel dashboard:

# 1. Navigate to: Project Settings → Environment Variables

# 2. Add each variable with scope:

# Database (from Neon dashboard)
DATABASE_URL=postgresql://user:pass@ep-...-pooler.aws.neon.tech/db?sslmode=require&connect_timeout=15
# Environment: Production (user chose no preview DB)

DIRECT_URL=postgresql://user:pass@ep-....aws.neon.tech/db?sslmode=require
# Environment: Production

# Shopify (from Partner Dashboard)
SHOPIFY_API_KEY=your-client-id-from-partner-dashboard
# Environment: Production, Preview (same app for testing)

SHOPIFY_API_SECRET=your-client-secret-from-partner-dashboard
# Environment: Production, Preview
# Mark as "Sensitive" (cannot be viewed after creation)

SHOPIFY_APP_URL=https://your-app.vercel.app
# Environment: Production
# CRITICAL: Must match application_url in shopify.app.production.toml

SCOPES=write_draft_orders,read_products,write_products
# Environment: Production, Preview

# Optional - Vercel auto-injects these
# VERCEL_URL - current deployment URL
# VERCEL_ENV - "production" | "preview" | "development"
```

**Source:** [Vercel environment variables](https://vercel.com/docs/environment-variables)

### Prisma Schema Update for Neon

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"] // Already present
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Pooled connection (runtime)
  directUrl = env("DIRECT_URL")        // Direct connection (migrations)
}

// Models stay unchanged
```

**Why `directUrl`:** Neon's pooled connection uses PgBouncer in transaction mode, which doesn't support `SET`/`RESET` statements required by Prisma migrations. `directUrl` bypasses pooler for schema operations.

**Source:** [Neon Prisma migrations](https://neon.com/docs/guides/prisma-migrations)

### Vercel Deployment from GitHub

```bash
# 1. Connect GitHub repo to Vercel:
#    - Go to vercel.com/new
#    - Click "Import Git Repository"
#    - Select "GitHub" → authorize → select repo
#    - Project name: pricing-app (or auto-detected)
#    - Framework preset: Remix (auto-detected from package.json)
#    - Root directory: ./ (leave default)
#    - Build settings:
#      - Build command: npm run vercel-build
#      - Output directory: .vercel/output (auto-set by @vercel/remix)
#      - Install command: npm install (auto-detected)
#    - Environment variables: Add all from previous section
#    - Click "Deploy"

# 2. Configure auto-deploy:
#    Project Settings → Git → Production Branch: main
#    ✅ Automatically deploy all commits pushed to main
#    ✅ Enable preview deployments (user chose yes, but no preview DB)

# 3. First deploy:
#    - Push to main branch
#    - Vercel auto-deploys
#    - Build runs: prisma generate → migrate deploy → remix build
#    - Deployment URL: https://pricing-app-username.vercel.app

# 4. Verify deployment:
#    - Visit deployment URL
#    - Check build logs for "✓ Serverless Function created"
#    - Test /app route (should require Shopify auth)
```

**Source:** [Vercel Remix guide](https://vercel.com/docs/frameworks/remix)

### Testing Production App Install

```bash
# After deploying to Vercel:

# 1. Update shopify.app.production.toml:
client_id = "YOUR_PRODUCTION_CLIENT_ID"
application_url = "https://your-actual-app.vercel.app"
[auth]
redirect_urls = ["https://your-actual-app.vercel.app/auth/callback"]

# 2. Deploy config to Shopify:
shopify app deploy --config shopify.app.production.toml

# 3. Get install URL from Partner Dashboard:
#    Apps → [Your App] → Overview → "Test your app"
#    Copy "Install link" (e.g., https://pricing-app-3.myshopify.com/admin/oauth/install?client_id=...)

# 4. Open install link in browser
#    - Should redirect to Vercel URL
#    - OAuth flow completes
#    - App loads in Shopify admin iframe

# 5. Verify:
#    - Check Vercel logs for "Shopify session created"
#    - Test creating a price matrix
#    - Test REST API endpoint: curl https://your-app.vercel.app/api/v1/products/123/price?width=100&height=100
```

**Source:** [Shopify deployment testing](https://shopify.dev/docs/apps/launch/deployment/deploy-to-hosting-service)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@remix-run/vercel` adapter | `@vercel/remix` with Vite preset | Remix v2 (2023) | Zero-config deployment, auto-routing, no vercel.json needed |
| Custom server.js | Auto-generated serverless entry | Remix Vite plugin (2024) | Simplifies setup, enables Vercel optimizations |
| Single DATABASE_URL | Separate `directUrl` for migrations | Neon PgBouncer improvements (2024-2025) | Enables pooled connections for apps, direct for CLI |
| Manual prisma generate | Explicit in build command | Vercel caching behavior (ongoing) | Prevents stale client errors |
| Node.js 18 | Node.js 20+ | September 1, 2025 | Node 18 deprecated; must upgrade |
| Legacy environment secrets | Sensitive environment variables | May 1, 2024 | Improved security, clearer UX |

**Deprecated/outdated:**
- **`@remix-run/vercel` package:** Removed in Remix v2; use `@vercel/remix` instead
- **`vercel.json` with `routes` array for Remix:** Unnecessary with Vite preset; auto-generated from `app/routes`
- **`pgbouncer=true` query parameter:** No longer needed with Neon; prepared statements now supported in pooled mode
- **Node.js 18:** Deprecated for new deployments as of September 2025

**Source:** [Remix v2 migration](https://v2.remix.run/docs/start/v2/), [Vercel changelog](https://vercel.com/changelog), [Neon blog](https://neon.com/blog/prisma-dx-improvements)

## Open Questions

1. **Vercel subdomain stability:**
   - What we know: Default subdomain is `https://pricing-app-username.vercel.app`
   - What's unclear: Whether subdomain changes on redeploy or remains stable
   - Recommendation: Test first deploy, verify subdomain persists, then update Partner Dashboard. Vercel docs indicate subdomains are stable per project.

2. **Preview deployment behavior without preview database:**
   - What we know: User chose no preview database; preview deployments enabled
   - What's unclear: Whether to scope `DATABASE_URL` to Production-only or allow previews to use production DB (read-only testing)
   - Recommendation: Scope `DATABASE_URL` to Production environment only. Manually test preview branches locally before merging.

3. **Session storage table initialization:**
   - What we know: `@shopify/shopify-app-session-storage-postgresql` requires `Session` table
   - What's unclear: Whether package auto-creates table or requires manual migration
   - Recommendation: Verify in Prisma schema. If missing, add manual migration or use package's built-in setup.

## Sources

### Primary (HIGH confidence)

- [Vercel Remix Documentation](https://vercel.com/docs/frameworks/remix) - Official Vercel integration guide
- [Neon Prisma Guide](https://neon.com/docs/guides/prisma) - Connection string setup and migrations
- [Neon Connection Pooling](https://neon.com/docs/connect/connection-pooling) - PgBouncer configuration
- [Prisma Vercel Deployment](https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel) - Build command setup
- [Shopify Deployment Guide](https://shopify.dev/docs/apps/launch/deployment/deploy-to-hosting-service) - Environment variables and OAuth
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables) - Environment scoping
- [Vercel Node.js Versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) - Runtime compatibility
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) - Timeout and size constraints

### Secondary (MEDIUM confidence)

- [Neon Connection Latency](https://neon.com/docs/connect/connection-latency) - Cold start mitigation
- [Shopify App Configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration) - TOML file structure
- [Vercel Changelog: Remix v2](https://vercel.com/changelog/support-for-remix-v2) - Integration history
- [Medium: Setting up Remix + Vercel](https://medium.com/@henriquetome98/setting-up-remix-vercel-9124fd39f07f) - Community guide
- [Build with Matija: Vercel Neon Setup](https://www.buildwithmatija.com/blog/vercel-neon-nextjs-3-tier-setup) - Database isolation patterns

### Tertiary (LOW confidence)

- [GitHub: Remix deployment discussion](https://github.com/remix-run/remix/discussions/7449) - Community troubleshooting (2023)
- [Shopify community: Hosting on Vercel](https://community.shopify.com/t/how-to-host-your-shopify-apps-on-cloudflare-vercel/353780) - User experiences

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Vercel and Neon documentation verified
- Architecture: HIGH - Vite preset pattern confirmed in Vercel docs; Neon dual-URL pattern in Prisma docs
- Pitfalls: MEDIUM-HIGH - Mix of official docs (database timeouts, Node version) and community reports (404 errors, OAuth issues)

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable deployment patterns, but Vercel/Neon features evolve monthly)
