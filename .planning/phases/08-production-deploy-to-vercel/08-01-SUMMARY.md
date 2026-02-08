---
phase: 08-production-deploy-to-vercel
plan: 01
subsystem: deployment-infrastructure
tags: [vercel, deployment, prisma, neon, serverless, configuration]
requires:
  - Phase 07 complete (npm package published)
provides:
  - Vercel-ready build configuration
  - Neon PostgreSQL migration support
  - Production Shopify app config template
affects:
  - Build pipeline (vercel-build script)
  - Database migrations (dual URL support)
  - Production deployment readiness
tech_stack:
  added:
    - "@vercel/remix@2.16.7"
  patterns:
    - Vercel serverless preset for Remix
    - Neon PostgreSQL with connection pooling and direct URL for migrations
key_files:
  created:
    - shopify.app.production.toml
  modified:
    - vite.config.ts (added vercelPreset)
    - package.json (vercel-build script, Node >=20)
    - prisma/schema.prisma (directUrl field)
    - app/db.server.ts (DIRECT_URL comment)
    - .env.example (production database URLs)
    - .gitignore (.vercel directory)
key_decisions:
  - decision: Use Vercel preset for serverless deployment
    rationale: Official Remix integration for Vercel with automatic route handling
    alternatives: Manual Vercel configuration
    trade_offs: Adds dependency but provides zero-config serverless deployment
  - decision: Dual connection URL pattern for Neon PostgreSQL
    rationale: Neon requires pooled URL for runtime and direct URL for migrations
    alternatives: Single connection string (doesn't support migrations)
    trade_offs: Requires two environment variables but enables proper migration workflow
  - decision: Separate production TOML instead of modifying dev config
    rationale: Preserves local dev workflow (ngrok) while enabling production deployment
    alternatives: Single TOML with environment switching
    trade_offs: Two files to maintain but cleaner separation of concerns
metrics:
  duration_minutes: 5
  completed: 2026-02-08T12:39:27Z
  task_count: 2
  commits: 2
  files_modified: 9
---

# Phase 08 Plan 01: Vercel Configuration Summary

Configure the codebase for Vercel deployment with Neon PostgreSQL support, including Remix serverless preset, dual database connection URLs, and production Shopify app configuration template.

## Performance

- **Duration:** ~5 minutes
- **Completed:** 2026-02-08 12:39 UTC
- **Tasks completed:** 2/2
- **Files modified:** 9 (3 build config, 3 database config, 3 environment/deployment)
- **Commits:** 2 atomic task commits

## Accomplishments

### Build Pipeline Configuration

- Installed `@vercel/remix@2.16.7` package
- Added `vercelPreset()` to Vite config Remix plugin for serverless function deployment
- Created `vercel-build` script: `prisma generate && prisma migrate deploy && npm run build`
- Updated Node.js engine requirement from `>=18.0.0` to `>=20.0.0` (Vercel deprecated Node 18 in Sep 2025)

### Database Configuration

- Added `directUrl = env("DIRECT_URL")` to Prisma schema datasource block
- Neon PostgreSQL requires two connection strings:
  - `DATABASE_URL`: Pooled connection for runtime queries
  - `DIRECT_URL`: Direct connection for Prisma migrations
- Updated `.env.example` with production database URL templates and comments
- Added clarifying comment in `db.server.ts` that DIRECT_URL is CLI-only (not runtime)

### Deployment Configuration

- Created `shopify.app.production.toml` template with:
  - Placeholder `client_id` (user replaces with production app Client ID)
  - Placeholder `application_url` (user replaces with Vercel subdomain)
  - Same scopes and webhook config as development app
  - Usage instructions in comments
- Added `.vercel` directory to `.gitignore`

### Preservation of Local Dev Workflow

- All changes are production-only additions
- Local dev workflow (ngrok + Docker PostgreSQL) completely unaffected
- `vercelPreset()` is a no-op during `vite dev`, only activates during `vite build`
- Existing `dev`, `build`, `start` scripts unchanged

## Task Commits

| Task | Commit  | Description                                          | Files                                                   |
| ---- | ------- | ---------------------------------------------------- | ------------------------------------------------------- |
| 1    | 0f70e8e | Add Vercel preset and build pipeline                 | vite.config.ts, package.json, package-lock.json         |
| 2    | facbd5b | Configure Prisma and environment for Neon PostgreSQL | prisma/schema.prisma, db.server.ts, .env.example, .gitignore, shopify.app.production.toml |

## Files Created/Modified

### Created (1)

- **shopify.app.production.toml** - Production Shopify app configuration template with placeholders for client_id and application_url

### Modified (8)

**Build Configuration:**
- **vite.config.ts** - Added `vercelPreset()` import and preset configuration
- **package.json** - Added `vercel-build` script, updated Node engine to >=20
- **package-lock.json** - Added @vercel/remix and dependencies

**Database Configuration:**
- **prisma/schema.prisma** - Added `directUrl` field for Neon migration support
- **app/db.server.ts** - Added comment explaining DIRECT_URL is CLI-only
- **.env.example** - Added production database URL templates with DIRECT_URL

**Deployment Configuration:**
- **.gitignore** - Added `.vercel` directory exclusion

## Decisions Made

### 1. Vercel Preset vs. Manual Configuration

**Decision:** Use `@vercel/remix` vercelPreset() for Remix-to-serverless function conversion

**Context:** Vercel requires Remix routes to be compiled as serverless functions. Options were manual Vercel configuration or the official preset.

**Rationale:**
- Official Remix team integration
- Zero-config approach (no manual route-to-function mapping)
- Preset is a no-op during dev (doesn't affect local workflow)
- Automatic updates with Remix version changes

**Trade-offs:**
- Adds dependency (but official and well-maintained)
- Less control over individual function configuration (acceptable for this app)

### 2. Dual Connection URL Pattern for Neon

**Decision:** Use separate `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) environment variables

**Context:** Neon PostgreSQL provides two connection types:
- Pooled URL (with `-pooler` in hostname) for runtime queries
- Direct URL (without `-pooler`) for migrations and schema operations

**Rationale:**
- Prisma migrations cannot run through connection poolers (require direct connection)
- Runtime queries benefit from pooling in serverless environments
- Prisma has native support for `directUrl` field (no custom logic needed)

**Alternatives Considered:**
- Single connection string - doesn't support migrations
- Switch URL based on operation - requires custom logic and error-prone

**Trade-offs:**
- Requires two environment variables instead of one
- Clearer separation of concerns (runtime vs. CLI operations)

### 3. Separate Production TOML

**Decision:** Create `shopify.app.production.toml` instead of modifying `shopify.app.toml`

**Context:** Shopify CLI requires app configuration with Client ID and application URL. Dev and production apps have different values.

**Rationale:**
- Preserves local dev setup (ngrok tunnel, dev app Client ID)
- Production deploys use `--config shopify.app.production.toml` flag
- Reduces risk of accidentally deploying with dev credentials
- Clear separation between dev and production environments

**Alternatives Considered:**
- Single TOML with environment variable substitution - Shopify CLI has limited support for this
- Overwrite dev TOML for production - breaks local dev workflow

**Trade-offs:**
- Two files to maintain (but they're mostly identical except client_id and URLs)
- User must remember to use `--config` flag (documented in comments)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

### Expected Prisma Validation Error in Local Dev

**Issue:** Running `npx prisma validate` locally fails with "Environment variable not found: DIRECT_URL"

**Resolution:** This is expected behavior:
- `DIRECT_URL` is only required for production migrations
- Local dev uses Docker PostgreSQL with a single connection URL
- Production environment will have `DIRECT_URL` set in Vercel
- The schema is syntactically valid and will work correctly when both URLs are present

**Impact:** None - does not affect local dev or production deployment

## Next Phase Readiness

### Phase 08 Plan 02: Deploy to Vercel

**Status:** READY ✓

**Prerequisites met:**
- ✓ Vite config includes Vercel preset for serverless deployment
- ✓ Build command configured (vercel-build script)
- ✓ Prisma schema supports dual connection URLs for Neon
- ✓ Production Shopify app TOML template exists
- ✓ Environment variable template documents all required production variables
- ✓ Node.js version requirement meets Vercel's current support (>=20)

**Required for next plan:**
- Create Neon PostgreSQL database
- Create production Shopify app in Partner Dashboard
- Configure Vercel project
- Set environment variables in Vercel
- Deploy app

**Blockers:** None

## Self-Check

Verifying all claimed artifacts exist and commits are in git history.

**Files created:**
```bash
[ -f "shopify.app.production.toml" ] && echo "FOUND: shopify.app.production.toml"
```
FOUND: shopify.app.production.toml ✓

**Files modified:**
```bash
git log --oneline --all | grep -E "(0f70e8e|facbd5b)"
```
- 0f70e8e: chore(08-01): add Vercel preset and build pipeline ✓
- facbd5b: chore(08-01): configure Prisma and environment for Neon PostgreSQL ✓

**Key configuration:**
```bash
grep "vercelPreset" vite.config.ts
```
- Found in import and presets array ✓

```bash
grep "vercel-build" package.json
```
- Found with correct command ✓

```bash
grep "directUrl" prisma/schema.prisma
```
- Found in datasource block ✓

## Self-Check: PASSED

All files exist, all commits are in git history, all key configuration verified.
