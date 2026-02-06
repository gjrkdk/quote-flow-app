# Phase 5: React Widget (npm Package) - Research

**Researched:** 2026-02-06
**Domain:** React component library, npm package publishing, Shadow DOM
**Confidence:** HIGH

## Summary

Phase 5 requires building a drop-in React widget published as an npm package that developers can install and use in headless storefronts. The widget provides dimension inputs with live pricing by calling the Phase 4 REST API and creates Draft Orders for checkout.

The standard approach uses **Vite in library mode** with TypeScript and peer dependencies for React 18. The widget will use **Shadow DOM** for CSS isolation and **CSS custom properties** for theming. Key challenges include Shadow DOM event handling with React, proper peer dependency configuration, and debounced API calls for performance.

**Primary recommendation:** Use Vite library mode with vite-plugin-dts for TypeScript declarations, implement Shadow DOM via react-shadow library, use use-debounce hook for input debouncing (300-500ms), and publish to npm with React 18 as peer dependency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Widget Inputs & Interaction:**
- Text fields only for width and height (no sliders)
- Display merchant's configured unit (cm or mm) — fetched from API, not a developer prop
- Inline validation errors under each field (e.g., "Width must be between 30-100 cm")
- Show valid dimension range upfront as placeholder/helper text so customers know bounds before typing

**Price Display & Loading:**
- Total price only — no breakdown (unit price, dimensions, etc.)
- Debounced price fetch ~300-500ms after customer stops typing
- Skeleton/shimmer placeholder while price is loading
- No price shown until customer enters valid width and height (empty initial state)

**Add-to-Cart Flow:**
- "Add to Cart" creates Draft Order and redirects to Shopify checkout
- Quantity selector with +/- buttons included
- Button disabled until both dimensions are valid and price is loaded
- Loading spinner inside button while Draft Order is being created

**Developer API & Props:**
- Three required props: `apiKey`, `productId`, `apiUrl` (no hardcoded default URL)
- Theming via CSS custom properties (e.g., `--pm-primary-color`) as default, with optional `theme` prop object that sets them
- Single callback: `onAddToCart` — fires when Draft Order is created. Minimal API surface for v1.
- Currency formatting automatic — API returns currency code, widget uses browser `Intl.NumberFormat`

**Specific Requirements:**
- API response needs `currency` field added (currently returns "store-default")
- API response should include dimension range (min/max width/height) for client-side validation and placeholder hints
- Merchant's unit preference (cm/mm) should come from API response (currently available as `store.unitPreference`)

### Claude's Discretion

The following are open for Claude to decide during planning:
- Debounce timing (within 300-500ms range)
- Exact CSS custom property names and defaults
- Shadow DOM implementation details
- Internal component structure and state management
- npm package naming and build tooling

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

## Standard Stack

The established libraries/tools for React component libraries in 2026:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | ^5.0+ | Build tool with library mode | Pre-configured for optimized library bundles, uses Rollup internally, modern DX |
| React | ^18.2.0 | UI framework (peer dependency) | Target version for widget consumers |
| TypeScript | ^5.3+ | Type safety | Standard for published libraries, improves DX |
| vite-plugin-dts | ^3.0+ | Generate TypeScript declarations | Automatically creates .d.ts files for library consumers |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| use-debounce | ^10.0+ | Debounce hook | Input debouncing for API calls (< 1 KB, drop-in replacement for lodash) |
| react-shadow | ^20.0+ | Shadow DOM for React | CSS isolation when embedding widget in third-party sites |
| react-loading-skeleton | ^3.0+ | Skeleton UI | Shimmer placeholders for loading states |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite | Rollup directly | More config boilerplate, no dev server, harder setup |
| vite-plugin-dts | tsup | Different build tool entirely, less Vite ecosystem integration |
| react-shadow | Manual Shadow DOM | More code, harder event handling, no React integration |
| use-debounce | lodash.debounce | Larger bundle, not React-aware (no cleanup on unmount) |

**Installation (for widget development):**
```bash
npm install react react-dom  # peer dependencies (dev only)
npm install vite vite-plugin-dts typescript @types/react @types/react-dom --save-dev
npm install use-debounce react-shadow
```

## Architecture Patterns

### Recommended Project Structure

```
pricing-app/
├── packages/
│   └── widget/                    # Widget npm package
│       ├── src/
│       │   ├── index.ts           # Public API exports
│       │   ├── PriceMatrixWidget.tsx  # Main component
│       │   ├── components/        # Internal UI components
│       │   │   ├── DimensionInput.tsx
│       │   │   ├── PriceDisplay.tsx
│       │   │   ├── QuantitySelector.tsx
│       │   │   └── AddToCartButton.tsx
│       │   ├── hooks/             # Custom hooks
│       │   │   ├── usePriceFetch.ts
│       │   │   └── useDraftOrder.ts
│       │   ├── types.ts           # TypeScript types
│       │   └── styles.css         # Widget styles (bundled separately)
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── README.md
└── (existing Remix app files)
```

**Key principles:**
- Single entry point (`index.ts`) exports only public API
- Internal components not exported (keeps API surface minimal)
- Hooks encapsulate logic (API calls, Draft Order creation)
- CSS bundled separately for optional import

### Pattern 1: Vite Library Configuration

**What:** Configure Vite to build a library with proper externals and TypeScript declarations

**When to use:** Always for npm packages that depend on React

**Example:**
```typescript
// packages/widget/vite.config.ts
// Source: https://vite.dev/guide/build.html
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      rollupTypes: true,  // Bundle types into single file
      exclude: ['**/*.test.tsx', '**/*.stories.tsx']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PriceMatrixWidget',
      formats: ['es', 'umd'],
      fileName: (format) => `price-matrix-widget.${format}.js`
    },
    rollupOptions: {
      // Externalize peer dependencies
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
});
```

### Pattern 2: Package.json Configuration

**What:** Proper exports, peer dependencies, and package metadata

**When to use:** Always for published npm packages

**Example:**
```json
{
  "name": "@pricing-app/widget",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/price-matrix-widget.umd.js",
  "module": "./dist/price-matrix-widget.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/price-matrix-widget.es.js",
      "require": "./dist/price-matrix-widget.umd.js"
    },
    "./styles.css": "./dist/style.css"
  },
  "files": [
    "dist"
  ],
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "dependencies": {
    "use-debounce": "^10.0.0",
    "react-shadow": "^20.0.0"
  }
}
```

### Pattern 3: Shadow DOM Integration

**What:** Wrap widget content in Shadow DOM for CSS isolation

**When to use:** When embedding in third-party sites where CSS conflicts are likely

**Example:**
```typescript
// Source: https://javascript.plainenglish.io/how-i-solved-css-conflicts-in-react-using-shadow-dom-and-portals-be3ee3f18aba
import root from 'react-shadow';

export function PriceMatrixWidget(props: WidgetProps) {
  return (
    <root.div>
      <style>{`
        /* Styles scoped to Shadow DOM */
        :host {
          --pm-primary-color: var(--pm-primary-color, #5c6ac4);
          --pm-text-color: var(--pm-text-color, #202223);
        }
        .widget-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
          color: var(--pm-text-color);
        }
      `}</style>
      <div className="widget-container">
        {/* Widget content */}
      </div>
    </root.div>
  );
}
```

**CRITICAL:** Shadow DOM requires special event handling (see Common Pitfalls).

### Pattern 4: Debounced Input with API Fetch

**What:** Debounce user input to reduce API calls, manage loading states

**When to use:** Any input that triggers expensive operations (API calls, calculations)

**Example:**
```typescript
// Source: https://github.com/xnimorz/use-debounce
import { useDebounce } from 'use-debounce';
import { useState, useEffect } from 'react';

function usePriceFetch(apiUrl: string, apiKey: string, productId: string) {
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [debouncedWidth] = useDebounce(width, 400);
  const [debouncedHeight] = useDebounce(height, 400);
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debouncedWidth || !debouncedHeight) {
      setPrice(null);
      return;
    }

    const fetchPrice = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiUrl}/api/v1/products/${productId}/price?width=${debouncedWidth}&height=${debouncedHeight}`,
          {
            headers: { 'X-API-Key': apiKey }
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch price');
        }

        const data = await response.json();
        setPrice(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
  }, [debouncedWidth, debouncedHeight, apiUrl, apiKey, productId]);

  return { width, height, setWidth, setHeight, price, loading, error };
}
```

### Pattern 5: Currency Formatting with Intl.NumberFormat

**What:** Locale-aware currency formatting using browser API

**When to use:** Displaying prices to end users (automatically handles currency symbols, decimals)

**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
function PriceDisplay({ amount, currency }: { amount: number; currency: string }) {
  // Cache formatter instance for performance
  const formatter = useMemo(() =>
    new Intl.NumberFormat(navigator.language, {
      style: 'currency',
      currency: currency,
    }),
    [currency]
  );

  return <span>{formatter.format(amount)}</span>;
}
```

**Browser support:** Baseline widely available since September 2017.

### Pattern 6: CSS Custom Properties for Theming

**What:** Expose theme variables as CSS custom properties with defaults

**When to use:** Allowing consumers to customize widget appearance without prop drilling

**Example:**
```typescript
// Source: https://www.epicreact.dev/css-variables
export interface ThemeProps {
  primaryColor?: string;
  textColor?: string;
  borderRadius?: string;
}

export function PriceMatrixWidget(props: WidgetProps) {
  const themeStyles = {
    '--pm-primary-color': props.theme?.primaryColor || '#5c6ac4',
    '--pm-text-color': props.theme?.textColor || '#202223',
    '--pm-border-radius': props.theme?.borderRadius || '4px',
  } as React.CSSProperties;

  return (
    <root.div style={themeStyles}>
      <style>{`
        :host {
          /* CSS vars inherited by all children */
        }
        button {
          background: var(--pm-primary-color);
          color: white;
          border-radius: var(--pm-border-radius);
        }
      `}</style>
      {/* ... */}
    </root.div>
  );
}
```

**Why CSS variables over Context:** No component reconciliation, better performance, works in Shadow DOM.

### Anti-Patterns to Avoid

- **Bundling React in the library:** Always externalize React and react-dom to avoid duplicate React instances (causes hooks errors)
- **Not caching Intl.NumberFormat:** Creating new formatter on every render is slow. Use `useMemo`.
- **Using lodash for debounce:** Use `use-debounce` hook instead—it's React-aware and handles cleanup on unmount
- **Hardcoding API URLs:** Always require `apiUrl` prop—different environments (dev, staging, prod) need different URLs
- **Exporting internal components:** Only export main widget component to keep API surface minimal (prevents breaking changes)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input debouncing | Custom setTimeout logic | `use-debounce` hook | Handles cleanup on unmount, cancellation, isPending state, flush() method |
| Shadow DOM in React | Manual attachShadow() | `react-shadow` library | Handles React event system integration, portal rendering, style injection |
| Currency formatting | String concatenation + toFixed() | `Intl.NumberFormat` | Locale-aware (handles €12.345,67 vs $12,345.67), currency-specific decimals (JPY has 0) |
| Skeleton loaders | Custom shimmer CSS | `react-loading-skeleton` | Accessible, SSR-safe, automatic width adaptation |
| TypeScript declarations | Manual .d.ts writing | `vite-plugin-dts` | Generates from source, handles complex types, bundles declarations |
| Rate limiting API calls | Custom token bucket | Debouncing + browser caching | Simpler for user input, browser handles HTTP caching headers |

**Key insight:** React ecosystem has mature solutions for common widget patterns. Custom implementations miss edge cases (unmount cleanup, browser compatibility, accessibility) that libraries handle.

## Common Pitfalls

### Pitfall 1: Shadow DOM Event Handling with React

**What goes wrong:** Events inside Shadow DOM fire multiple times when bubbling through React's virtual DOM, or event.target is retargeted to the shadow host instead of the actual element.

**Why it happens:** React 17+ uses event delegation on the root, but Shadow DOM retargets events when crossing boundaries. This causes duplicate event handling or incorrect event.target references.

**How to avoid:**
- Use `event.composedPath()` instead of `event.target` to get the actual originating element
- Replace `node.contains(event.target)` with `event.composedPath().includes(node)`
- For form submission, explicitly handle the event at the form level (not document level)

**Warning signs:**
- Form submits twice
- Click handlers fire multiple times
- Event.target is always the shadow host, not the button you clicked

**Source:** https://github.com/facebook/react/issues/24136

### Pitfall 2: Peer Dependency Version Conflicts

**What goes wrong:** Users get peer dependency errors during npm install, or multiple React versions get installed causing "Invalid hook call" errors.

**Why it happens:** Too strict peer dependency ranges (e.g., `"react": "18.2.0"`) or conflicting versions from other libraries.

**How to avoid:**
- Use flexible ranges: `"react": "^18.0.0"` (allows 18.x.x)
- Test against minimum and maximum supported versions
- Document supported React versions in README
- Never bundle React in your library build (use `external` in Vite config)

**Warning signs:**
- "Invalid hook call" errors in console
- npm/pnpm peer dependency warnings during install
- Multiple react packages in node_modules (check with `npm ls react`)

**Source:** https://blog.bitsrc.io/dependency-handling-in-react-e596c4567c89

### Pitfall 3: Missing Files in Published Package

**What goes wrong:** npm publish uploads src/ directory or omits dist/ directory, causing import errors for consumers.

**Why it happens:** Forgetting to configure `"files": ["dist"]` in package.json, or not running build before publish.

**How to avoid:**
- Always set `"files": ["dist"]` in package.json (whitelist what to publish)
- Use `npm pack` locally before publishing to inspect tarball contents
- Add prepublishOnly script: `"prepublishOnly": "npm run build"`
- Add dist/ to .gitignore but NOT to .npmignore

**Warning signs:**
- Consumers report "Cannot find module" errors
- Published package size is unusually large (includes node_modules or src)
- TypeScript types not found despite "types" field in package.json

**Source:** https://www.agilesoftlabs.com/blog/2026/02/from-component-to-npm-publishing-react

### Pitfall 4: CORS Credentials Not Sent

**What goes wrong:** Fetch API calls from widget to REST API fail with CORS errors, or API authentication doesn't work from cross-origin.

**Why it happens:** By default, `fetch()` doesn't send credentials (cookies, auth headers) for cross-origin requests. API needs `Access-Control-Allow-Credentials: true` and fetch needs `credentials: 'include'`.

**How to avoid:**
- Widget uses `X-API-Key` header (NOT cookies), so credentials are not needed
- Verify CORS headers on API allow `X-API-Key` header: `Access-Control-Allow-Headers: X-API-Key`
- Phase 4 API already has CORS configured correctly (verified in 04-VERIFICATION.md)

**Warning signs:**
- Fetch works in Postman/curl but fails from browser
- API returns 401 despite correct X-API-Key header
- Browser console shows CORS preflight (OPTIONS) failure

**Source:** https://byby.dev/js-fetch-cors-credentials

### Pitfall 5: Debounce Not Cleaning Up on Unmount

**What goes wrong:** Debounced function fires after component unmounts, causing "Can't perform a React state update on an unmounted component" warnings.

**Why it happens:** Using plain `setTimeout` or lodash.debounce without cleanup in useEffect.

**How to avoid:**
- Use `use-debounce` hook (handles cleanup automatically)
- If using custom debounce, return cleanup function from useEffect:
  ```typescript
  useEffect(() => {
    const timer = setTimeout(() => { /* ... */ }, 400);
    return () => clearTimeout(timer);  // Cleanup on unmount
  }, [deps]);
  ```

**Warning signs:**
- Console warnings about state updates on unmounted components
- Memory leaks in long-running SPAs
- API calls firing after navigation away from page

**Source:** https://medium.com/@sankalpa115/usedebounce-hook-in-react-2c71f02ff8d8

### Pitfall 6: Not Testing Against Real API Early

**What goes wrong:** Widget works with mocked data in dev but fails with real API due to unexpected error formats, missing fields, or CORS issues.

**Why it happens:** Building widget in isolation without integration testing against Phase 4 API.

**How to avoid:**
- Connect to real API (local or dev environment) early in development
- Test error cases: 401 (bad API key), 400 (invalid dimensions), 404 (no matrix), 500 (server error)
- Verify RFC 7807 error format matches expectations
- Test CORS preflight works from different origins

**Warning signs:**
- Widget crashes on error responses (unexpected JSON shape)
- Error messages show `[object Object]` instead of user-friendly text
- Widget works on localhost but fails when deployed to different domain

**Source:** Best practice from https://www.agilesoftlabs.com/blog/2026/02/from-component-to-npm-publishing-react

## Code Examples

Verified patterns from official sources:

### Example 1: Minimal Widget Public API

```typescript
// packages/widget/src/index.ts
// Export only public API—internal components stay private
export { PriceMatrixWidget } from './PriceMatrixWidget';
export type {
  PriceMatrixWidgetProps,
  ThemeProps,
  AddToCartEvent
} from './types';

// Do NOT export internal components like DimensionInput, PriceDisplay, etc.
// This keeps API surface minimal and prevents breaking changes
```

### Example 2: Widget Props Interface

```typescript
// packages/widget/src/types.ts
export interface PriceMatrixWidgetProps {
  /** REST API base URL (e.g., "https://pricing-app-3.myshopify.com") */
  apiUrl: string;

  /** API key for authentication */
  apiKey: string;

  /** Shopify product ID (numeric or gid:// format) */
  productId: string;

  /** Optional theme customization */
  theme?: ThemeProps;

  /** Callback fired when Draft Order is created */
  onAddToCart?: (event: AddToCartEvent) => void;
}

export interface ThemeProps {
  primaryColor?: string;
  textColor?: string;
  borderColor?: string;
  borderRadius?: string;
  fontSize?: string;
}

export interface AddToCartEvent {
  draftOrderId: string;
  checkoutUrl: string;
  price: number;
  dimensions: { width: number; height: number; unit: string };
  quantity: number;
}
```

### Example 3: Skeleton Loader for Price Display

```typescript
// Source: https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

function PriceDisplay({ price, loading, error }: PriceDisplayProps) {
  if (error) {
    return <div className="price-error">{error}</div>;
  }

  if (loading) {
    return (
      <div className="price-skeleton">
        <Skeleton width={120} height={32} />
      </div>
    );
  }

  if (price === null) {
    return null;  // No price until valid dimensions entered
  }

  return (
    <div className="price-display">
      {formatCurrency(price, 'USD')}
    </div>
  );
}
```

### Example 4: Draft Order Creation

```typescript
// packages/widget/src/hooks/useDraftOrder.ts
export function useDraftOrder(apiUrl: string, apiKey: string) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDraftOrder = async (params: {
    productId: string;
    width: number;
    height: number;
    quantity: number;
  }) => {
    setCreating(true);
    setError(null);

    try {
      // NOTE: Phase 4 API only provides pricing—Draft Order endpoint needs to be added
      const response = await fetch(`${apiUrl}/api/v1/draft-orders`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create draft order');
      }

      const data = await response.json();
      return {
        draftOrderId: data.draftOrderId,
        checkoutUrl: data.checkoutUrl,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  return { createDraftOrder, creating, error };
}
```

**NOTE:** Phase 4 API does not include Draft Order creation endpoint. This needs to be added as part of Phase 5 or as a separate task.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Webpack + Babel for libraries | Vite in library mode | 2023-2024 | Faster builds, simpler config, better tree-shaking |
| rollup-plugin-peer-deps-external | Vite's built-in `external` config | 2023 | One less plugin, built into Vite |
| Manual .d.ts files | vite-plugin-dts | 2023 | Automatic type generation from source |
| lodash.debounce | use-debounce hook | 2021-2022 | React-aware cleanup, smaller bundle |
| Inline styles or CSS-in-JS | CSS custom properties | 2024-2025 | Better performance, no JS reconciliation, works in Shadow DOM |
| Context API for theming | CSS variables | 2024-2025 | No React re-renders, simpler API |
| React 17 event delegation | React 18 + composedPath() | 2022 | Better Shadow DOM support |

**Deprecated/outdated:**
- **react-dom/server renderToStaticMarkup for widgets:** Shadow DOM components can't be SSR'd (browser-only feature)
- **npm link for local testing:** Use `npm pack` instead (more accurate simulation of published package)
- **peerDependenciesMeta with optional: true:** npm 7+ handles peer deps automatically, no need for optional flag

## Open Questions

Things that couldn't be fully resolved:

1. **Draft Order API Endpoint**
   - What we know: Phase 4 API provides pricing only (GET /api/v1/products/:id/price). Phase 3 has Draft Order creation logic in Remix app.
   - What's unclear: Does widget need a new REST endpoint (POST /api/v1/draft-orders) or should it use existing Shopify Draft Order API directly?
   - Recommendation: Add REST endpoint for Draft Order creation as part of Phase 5. This keeps authentication consistent (X-API-Key) and allows server-side validation. Reuse Phase 3 Draft Order logic.

2. **API Response Format for Dimension Ranges**
   - What we know: Phase 4 API returns price but not matrix metadata (min/max dimensions)
   - What's unclear: Should GET /price endpoint be extended to include matrix bounds, or should there be a separate GET /products/:id/matrix endpoint?
   - Recommendation: Extend Phase 4 API response to include `dimensionRange: { minWidth, maxWidth, minHeight, maxHeight }` field. Simpler than second endpoint, widget needs this data anyway for validation.

3. **Currency Field in API Response**
   - What we know: Phase 4 API returns `currency: "store-default"` (placeholder)
   - What's unclear: How to get actual store currency? Shopify API? Database field?
   - Recommendation: Add `currency` field to Store model in Prisma schema, fetch from Shopify Admin API during app installation, return ISO 4217 code (USD, EUR, etc.) in Phase 4 API response.

4. **npm Package Scope/Name**
   - What we know: Standard practice is scoped packages (@org/package-name)
   - What's unclear: What scope to use? @pricing-app? @shopify? Or unscoped?
   - Recommendation: Use `@pricing-matrix/widget` or similar descriptive scope. Avoid @shopify (not official Shopify package).

## Sources

### Primary (HIGH confidence)

- [Vite Library Mode Documentation](https://vite.dev/guide/build.html) - Official Vite docs on building libraries
- [MDN: Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) - Currency formatting API
- [use-debounce GitHub](https://github.com/xnimorz/use-debounce) - Debounce hook library
- [React Issue #24136](https://github.com/facebook/react/issues/24136) - Shadow DOM event handling bug

### Secondary (MEDIUM confidence)

- [JavaScript.info: Shadow DOM Events](https://javascript.info/shadow-dom-events) - Event retargeting and composed paths
- [LogRocket: React Loading Skeleton](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/) - Skeleton UI patterns
- [Kent C. Dodds: CSS Variables](https://www.epicreact.dev/css-variables) - CSS custom properties for theming
- [Bits and Pieces: Dependency Handling](https://blog.bitsrc.io/dependency-handling-in-react-e596c4567c89) - Peer dependencies best practices

### Secondary (verified via WebFetch)

- Phase 4 API implementation (`app/routes/api.v1.products.$productId.price.ts`) - Verified CORS headers, response format
- Phase 4 Verification Report (`04-VERIFICATION.md`) - Confirmed API authentication, error formats

### Tertiary (LOW confidence - WebSearch only)

- [AgileSoftLabs: Publishing React Native Components](https://www.agilesoftlabs.com/blog/2026/02/from-component-to-npm-publishing-react) - Recent 2026 guidance, but React Native not React
- [DEV Community: Shadow DOM CSS Isolation](https://javascript.plainenglish.io/how-i-solved-css-conflicts-in-react-using-shadow-dom-and-portals-be3ee3f18aba) - Personal blog, not official docs
- [DEV Community: Vite Component Library](https://dev.to/receter/how-to-create-a-react-component-library-using-vites-library-mode-4lma) - Community tutorial, not official Vite docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vite library mode and peer dependencies are industry standard, verified with official Vite docs
- Architecture: HIGH - Patterns verified with official React docs, MDN, and GitHub repos
- Shadow DOM: MEDIUM - React integration has known issues (GitHub #24136), react-shadow library is maintained but not official
- API integration: HIGH - Phase 4 API is verified and documented, CORS/auth patterns confirmed
- Pitfalls: HIGH - Common mistakes documented in official React issues and npm best practices

**Research date:** 2026-02-06
**Valid until:** ~30 days (Vite/React stable, but npm ecosystem moves quickly)

**Critical gaps requiring planning decisions:**
1. Draft Order API endpoint design (new REST endpoint vs direct Shopify API)
2. API response format extension (dimension ranges, currency)
3. npm package naming and scope
4. Internal component structure (how many files, which hooks)
