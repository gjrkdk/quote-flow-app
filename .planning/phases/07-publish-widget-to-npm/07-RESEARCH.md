# Phase 07: Publish Widget to npm - Research

**Researched:** 2026-02-06
**Domain:** npm package publishing, React component libraries
**Confidence:** HIGH

## Summary

Publishing `@pricing-matrix/widget` to npm requires authentication, package verification, and proper metadata configuration. The package is already well-structured with Vite library mode, TypeScript definitions, proper externals configuration, and the `prepublishOnly` build hook.

**Current state analysis:**
- Build configuration: READY (Vite library mode, ES + UMD formats, TypeScript definitions generated)
- Package exports: READY (modern `exports` field with proper type definitions)
- Dependencies: READY (React/React-DOM as peerDependencies, other deps properly categorized)
- Package size: 192.9 kB tarball, 695.2 kB unpacked (acceptable for React widget)
- Security audit: MODERATE vulnerabilities in devDependencies only (esbuild, vue-template-compiler) — not shipped in published package
- Missing: README.md, LICENSE file, repository/homepage/bugs metadata in package.json

**Primary recommendation:** Complete metadata and documentation (README, LICENSE, package.json fields), verify package contents with `npm pack --dry-run`, authenticate with npm, then publish as public scoped package using `npm publish --access public`.

## Standard Stack

The established tools for publishing React component libraries to npm in 2026:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | ^5.0.0 | Library bundler | Modern, fast build tool with native library mode |
| vite-plugin-dts | ^3.0.0 | TypeScript definitions | Generates .d.ts files and rolls them up for consumers |
| TypeScript | ^5.3.0 | Type safety | Industry standard for type-safe React libraries |
| React (peer) | ^18.0.0 | UI framework | Prevent version conflicts by using peerDependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-shadow | ^20.0.0 | Shadow DOM | CSS isolation for embedded widgets (already in use) |
| use-debounce | ^10.0.0 | Input debouncing | Utility library (can be regular dependency) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite | Rollup + tsc | More manual configuration, slower DX |
| Vite | Webpack | Slower builds, more complex config |
| vite-plugin-dts | tsc + manual bundling | Manual rollup of .d.ts files, no single-file output |

**Installation (for consumers):**
```bash
npm install @pricing-matrix/widget
# peerDependencies (must already exist):
# react ^18.0.0
# react-dom ^18.0.0
```

## Architecture Patterns

### Recommended Package Structure
```
packages/widget/
├── src/                    # Source code (NOT published)
│   ├── index.ts           # Public API exports
│   ├── types.ts           # Type definitions
│   └── PriceMatrixWidget.tsx
├── dist/                   # Build output (published via "files" field)
│   ├── index.d.ts         # Rolled-up TypeScript definitions
│   ├── price-matrix-widget.es.js   # ES module format
│   └── price-matrix-widget.umd.js  # UMD format (browser <script>)
├── package.json           # Published
├── README.md              # Published (MISSING - needs creation)
└── LICENSE                # Published (MISSING - needs creation)
```

### Pattern 1: Scoped Public Package Publishing
**What:** Scoped packages (`@org/name`) are private by default on npm. Must use `--access public` flag on first publish.
**When to use:** All scoped packages intended for public use.
**Example:**
```bash
# First publish requires --access public flag
npm publish --access public

# Subsequent publishes inherit the access level
npm publish
```
**Source:** [npm docs - Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

### Pattern 2: Pre-Publish Verification Workflow
**What:** Verify package contents and metadata before actual publish using dry-run commands.
**When to use:** Every publish, especially first release.
**Example:**
```bash
# 1. Verify build outputs exist
npm run build

# 2. Check what files will be included (respects "files" field)
npm pack --dry-run

# 3. Run all pre-publish checks without actually publishing
npm publish --dry-run

# 4. Actual publish
npm publish --access public  # first time only
```
**Source:** [Testing NPM Publish With A Dry Run](https://stevefenton.co.uk/blog/2024/01/testing-npm-publish/)

### Pattern 3: React/React-DOM as peerDependencies
**What:** React and React-DOM should be peerDependencies (NOT regular dependencies) to prevent bundling and version conflicts.
**When to use:** All React component libraries.
**Current config (CORRECT):**
```json
{
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```
**Why:**
- Prevents multiple React versions (causes Hook errors)
- Reduces bundle size (host app provides React)
- Matches what consumers already have installed

**Source:** [Should shared React Components use peerDependencies or dependencies?](https://github.com/kentcdodds/ama/issues/345)

### Pattern 4: Vite Library Mode with Externals
**What:** Configure Vite to bundle library code but externalize React dependencies.
**Current config (CORRECT):**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PriceMatrixWidget',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJSXRuntime',
        },
      },
    },
  },
});
```
**Why:** React is NOT bundled into the library, reducing size and preventing conflicts.

**Source:** [Vite - Building for Production](https://vite.dev/guide/build)

### Pattern 5: Modern Package Exports
**What:** Use `exports` field (not just `main`) for modern package resolution with TypeScript support.
**Current config (CORRECT):**
```json
{
  "type": "module",
  "main": "./dist/price-matrix-widget.umd.js",
  "module": "./dist/price-matrix-widget.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/price-matrix-widget.es.js",
      "require": "./dist/price-matrix-widget.umd.js"
    }
  }
}
```
**Why:**
- `exports` takes precedence in modern Node.js/bundlers
- `types` first ensures TypeScript finds definitions
- `import`/`require` conditions for ESM/CJS compatibility
- `main`/`module` for legacy bundler fallback

### Pattern 6: Version Bumping Workflow
**What:** Use `npm version` command to bump version, create git tag, then publish.
**When to use:** Every release after initial 0.1.0.
**Example:**
```bash
# For bug fixes
npm version patch  # 0.1.0 -> 0.1.1

# For new features (backward compatible)
npm version minor  # 0.1.1 -> 0.2.0

# For breaking changes
npm version major  # 0.2.0 -> 1.0.0

# Then publish
npm publish
```
**Source:** [How to Publish an Updated Version of an npm Package](https://cloudfour.com/thinks/how-to-publish-an-updated-version-of-an-npm-package/)

### Anti-Patterns to Avoid
- **Bundling React into library:** Causes multiple React instances, Hook errors, huge bundle size
- **Using regular dependencies for React:** Same as above, plus version lock-in for consumers
- **Publishing source code instead of dist:** Requires consumers to build your package
- **Missing `--access public` on scoped package:** Publish fails or creates private package (requires paid plan)
- **Not running `npm pack --dry-run`:** Risk publishing unwanted files (tests, .env, node_modules if misconfigured)
- **Starting at version 1.0.0:** Convention is to start at 0.1.0 for initial development, signal stability with 1.0.0

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript definition bundling | Custom tsc scripts + manual merging | vite-plugin-dts with `rollupTypes: true` | Already handles complex export mapping, interface merging, and single-file rollup |
| Version bumping | Manual package.json edits + git tags | `npm version [major\|minor\|patch]` | Atomic operation: updates package.json, creates commit, creates git tag |
| Package verification | Manual file listing | `npm pack --dry-run` | Shows exact tarball contents, respects .npmignore/.gitignore, displays sizes |
| Pre-publish safety checks | Custom scripts | `npm publish --dry-run` | Runs all validation (auth, version conflicts, metadata) without actual publish |
| License selection | Custom legal text | [choosealicense.com](https://choosealicense.com) + SPDX identifier | Legally vetted templates, machine-readable identifiers |

**Key insight:** npm CLI has battle-tested tools for package lifecycle. Custom scripts for version/publish workflows are error-prone and miss edge cases (auth failures, network errors, registry conflicts).

## Common Pitfalls

### Pitfall 1: Forgetting `--access public` on First Scoped Package Publish
**What goes wrong:** Scoped packages (`@org/name`) default to private visibility. Running `npm publish` without `--access public` either fails or creates a private package (requiring paid npm plan).
**Why it happens:** Unscoped packages default to public, scoped packages default to private.
**How to avoid:**
- First publish: `npm publish --access public`
- Subsequent publishes: `npm publish` (inherits access level)
- Or add to package.json: `"publishConfig": { "access": "public" }`
**Warning signs:** Publish fails with "402 Payment Required" or "must upgrade to paid plan"

**Source:** [Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

### Pitfall 2: Not Authenticated with npm Registry
**What goes wrong:** `npm publish` fails with "need auth" error. User has not logged in.
**Why it happens:** Publishing requires npm account and active session.
**How to avoid:**
```bash
# Check current auth status
npm whoami

# If not logged in, authenticate (creates 2-hour session token as of 2025)
npm login

# Verify authentication
npm whoami
```
**Warning signs:** Error message "need auth This command requires you to be logged in"
**Note:** As of December 2025, npm uses session-based authentication (2-hour tokens) and requires 2FA for publishing.

**Source:** [npm classic tokens revoked, session-based auth](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/)

### Pitfall 3: Publishing Without README or LICENSE
**What goes wrong:** Package appears incomplete/unprofessional on npmjs.com, users don't know how to use it or under what terms.
**Why it happens:** Developers focus on code, forget documentation is part of package.
**How to avoid:**
- Create `README.md` with: title, description, installation, usage example, API docs, license
- Create `LICENSE` file (MIT is common for open source)
- Both files automatically included in npm package (not in `.npmignore`)
**Warning signs:** Package page on npmjs.com shows "no README" or missing license field

**Source:** [About package README files](https://docs.npmjs.com/about-package-readme-files/)

### Pitfall 4: Missing Package Metadata (repository, homepage, bugs)
**What goes wrong:** Users can't find source code, report issues, or contribute. npmjs.com page has no links.
**Why it happens:** Fields are optional in package.json, easy to forget.
**How to avoid:** Add to package.json:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/gjrkdk/pricing-app.git",
    "directory": "packages/widget"
  },
  "homepage": "https://github.com/gjrkdk/pricing-app#readme",
  "bugs": "https://github.com/gjrkdk/pricing-app/issues"
}
```
**Warning signs:** npmjs.com package page has no GitHub link, no issue tracker link

**Source:** [package.json | npm Docs](https://docs.npmjs.com/cli/v7/configuring-npm/package-json/)

### Pitfall 5: Publishing devDependencies Vulnerabilities
**What goes wrong:** Security scanners flag package as vulnerable even though vulnerabilities are in dev tooling, not shipped code.
**Why it happens:** Confusion between devDependencies (build-time) and dependencies (runtime).
**How to avoid:**
- Run `npm audit` before publish to check all vulnerabilities
- devDependencies vulnerabilities (esbuild, vue-template-compiler) do NOT affect published package
- Only `dependencies` and `peerDependencies` affect consumers
- Current widget has MODERATE devDep vulnerabilities (acceptable for publish)
**Warning signs:** `npm audit` shows vulnerabilities, but check if they're in devDependencies
**Verification:**
```bash
# Check what's actually published
npm pack --dry-run

# devDependencies are NOT included (only dist/ folder)
```

**Source:** [Auditing package dependencies for security vulnerabilities](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/)

### Pitfall 6: Starting Version at 1.0.0 for Unproven Package
**What goes wrong:** Semantic versioning signals stability. 1.0.0 means "production-ready with stable API." Using it prematurely sets wrong expectations.
**Why it happens:** Developers think 1.0.0 sounds more legitimate than 0.x.
**How to avoid:**
- Start at 0.1.0 for initial development (signals "API may change")
- Bump to 1.0.0 when API is stable and battle-tested
- semver spec: "Major version zero (0.y.z) is for initial development. Anything MAY change at any time."
**Warning signs:** Publishing 1.0.0 but API might change based on early user feedback

**Source:** [Semantic Versioning 2.0.0](https://semver.org/)

### Pitfall 7: Publishing Unwanted Files
**What goes wrong:** Package includes tests, source maps, .env files, or other development artifacts, bloating size or leaking secrets.
**Why it happens:** Not verifying package contents before publish, misconfigured `files` field or `.npmignore`.
**How to avoid:**
- Use `files` field in package.json to whitelist published files (already set to `["dist"]` — CORRECT)
- Run `npm pack --dry-run` to preview exact contents
- Current widget: 4 files, 192.9 kB tarball (GOOD — only dist output + package.json)
**Warning signs:** Tarball size unexpectedly large, `npm pack` shows unexpected files

**Source:** [Smaller published NPM modules](https://glebbahmutov.com/blog/smaller-published-NPM-modules/)

## Code Examples

Verified patterns from current widget configuration and official sources:

### Publishing Workflow (Complete)
```bash
# Source: Composite of npm docs best practices
# 1. Ensure you're authenticated
npm whoami || npm login

# 2. Build the package
npm run build

# 3. Verify package contents (shows 4 files: dist/* + package.json)
npm pack --dry-run

# 4. Check for security issues (acceptable if devDeps only)
npm audit

# 5. Dry-run publish (runs all checks without actual publish)
npm publish --dry-run

# 6. Publish publicly (first time for scoped package)
npm publish --access public

# Subsequent publishes (after first):
npm publish
```

### Version Bump and Publish Workflow
```bash
# Source: npm version documentation
# For next release (e.g., 0.1.0 -> 0.2.0)
npm version minor

# This automatically:
# - Updates package.json version
# - Creates git commit
# - Creates git tag (v0.2.0)

# Then publish
npm publish

# Push tags to GitHub
git push --follow-tags
```

### Package.json Metadata (Complete)
```json
{
  "name": "@pricing-matrix/widget",
  "version": "0.1.0",
  "description": "Drop-in React widget for Shopify dimension-based pricing with live price updates and Draft Order checkout",
  "license": "MIT",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/gjrkdk/pricing-app.git",
    "directory": "packages/widget"
  },
  "homepage": "https://github.com/gjrkdk/pricing-app/tree/main/packages/widget#readme",
  "bugs": {
    "url": "https://github.com/gjrkdk/pricing-app/issues"
  },
  "keywords": [
    "shopify",
    "pricing",
    "widget",
    "react",
    "dimension-pricing",
    "draft-order"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

### README.md Structure (Essential Sections)
```markdown
# @pricing-matrix/widget

Drop-in React widget for Shopify dimension-based pricing with live price updates and Draft Order checkout.

## Installation

\`\`\`bash
npm install @pricing-matrix/widget
\`\`\`

**Peer Dependencies:**
- React ^18.0.0
- React-DOM ^18.0.0

## Usage

\`\`\`tsx
import { PriceMatrixWidget } from '@pricing-matrix/widget';

function App() {
  return (
    <PriceMatrixWidget
      apiUrl="https://your-app.example.com"
      apiKey="pm_abc123"
      productId="gid://shopify/Product/123"
      theme={{ primaryColor: '#ff6b6b' }}
      onAddToCart={(event) => {
        console.log('Order created:', event.draftOrderId);
        console.log('Checkout URL:', event.checkoutUrl);
      }}
    />
  );
}
\`\`\`

## API

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiUrl` | `string` | Yes | REST API base URL |
| `apiKey` | `string` | Yes | API key for authentication |
| `productId` | `string` | Yes | Shopify product ID |
| `theme` | `ThemeProps` | No | Theme customization |
| `onAddToCart` | `(event: AddToCartEvent) => void` | No | Callback when order created |

[See full TypeScript definitions](./dist/index.d.ts)

## Features

- ✅ Shadow DOM for CSS isolation
- ✅ Live price calculation as customer types
- ✅ Shopify Draft Order creation
- ✅ Customizable theming
- ✅ TypeScript support

## License

MIT
```
**Source:** [About package README files](https://docs.npmjs.com/about-package-readme-files/)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm classic tokens (permanent) | Session-based auth (2-hour) | Dec 2025 | Must run `npm login` before publishing, re-auth every 2 hours |
| Legacy access tokens | Granular access tokens | Nov 2025 | Better security, scoped permissions for CI/CD |
| `prepublish` script | `prepublishOnly` script | npm 4 (2016) | Only runs on `npm publish`, not on `npm install` |
| `main` + `module` fields | `exports` field (primary) | Node.js 12.7+ | Better control, conditional exports, TypeScript support |
| Manual TypeScript bundling | vite-plugin-dts with rollupTypes | 2023+ | Single .d.ts file, handles complex re-exports |

**Deprecated/outdated:**
- `prepublish` script: Replaced by `prepublishOnly` (runs on install AND publish, confusing behavior)
- Publishing without 2FA: Required by default as of late 2025
- `.npmignore` without `files` field: Use `files` whitelist instead of blacklist for safety

## Open Questions

Things that couldn't be fully resolved:

1. **Should widget be monorepo subpath or separate repository?**
   - What we know: Current setup is monorepo (`packages/widget/`), package.json has `directory` field pointing to subpath
   - What's unclear: npmjs.com will show monorepo link, not widget-specific docs. Is this desired UX?
   - Recommendation: Acceptable for v1. Can move to separate repo later if needed (package name stays same).

2. **Who is the package author/owner?**
   - What we know: GitHub repo is `gjrkdk/pricing-app`, user not authenticated with npm yet
   - What's unclear: npm account name, whether it's personal or organization
   - Recommendation: Fill in `author` field in package.json before publish, ensure npm account has access to `@pricing-matrix` scope

3. **Should version start at 0.1.0 or 1.0.0?**
   - What we know: Currently 0.1.0, widget is feature-complete from v1.0 MVP
   - What's unclear: Is API stable enough to guarantee no breaking changes?
   - Recommendation: Keep 0.1.0 for first publish (signals "may change"). Bump to 1.0.0 after initial user feedback confirms API stability. Semver convention favors 0.x for initial releases.

## Sources

### Primary (HIGH confidence)
- [npm Docs - Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [npm Docs - package.json](https://docs.npmjs.com/cli/v7/configuring-npm/package-json/)
- [npm Docs - About package README files](https://docs.npmjs.com/about-package-readme-files/)
- [npm Docs - About semantic versioning](https://docs.npmjs.com/about-semantic-versioning/)
- [Semantic Versioning 2.0.0](https://semver.org/)
- [Vite - Building for Production](https://vite.dev/guide/build)
- [npm Docs - Auditing package dependencies](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/)

### Secondary (MEDIUM confidence)
- [GitHub Blog - npm classic tokens revoked, session-based auth](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/)
- [Testing NPM Publish With A Dry Run](https://stevefenton.co.uk/blog/2024/01/testing-npm-publish/)
- [LogRocket - Complete guide to publishing React package to npm](https://blog.logrocket.com/the-complete-guide-to-publishing-a-react-package-to-npm/)
- [Should shared React Components use peerDependencies or dependencies?](https://github.com/kentcdodds/ama/issues/345)
- [How to Publish an Updated Version of an npm Package](https://cloudfour.com/thinks/how-to-publish-an-updated-version-of-an-npm-package/)
- [Best practices for publishing your npm package](https://mikbry.com/blog/javascript/npm/best-practices-npm-package)

### Tertiary (LOW confidence - WebSearch only)
- [From Component to npm: Publishing React Native Components](https://www.agilesoftlabs.com/blog/2026/02/from-component-to-npm-publishing-react) — Recent but not official source
- Various Medium/DEV.to articles on React library publishing — Community guidance, cross-verified with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vite library mode is documented, current config matches official examples
- Authentication/publishing: HIGH - Official npm docs, recent 2025 changes documented in GitHub changelog
- Architecture patterns: HIGH - package.json config verified working via `npm pack --dry-run`
- Security/vulnerabilities: HIGH - devDependencies do not affect published package (verified with `files: ["dist"]`)
- Documentation requirements: MEDIUM - Best practices from multiple sources, some variation in recommended sections
- Version strategy: MEDIUM - Semver convention clear (start 0.x), but decision point is subjective

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days — npm registry policies stable, authentication changes recent but documented)
