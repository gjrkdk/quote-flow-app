---
status: complete
phase: 05-react-widget
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md]
started: 2026-02-06T11:00:00Z
updated: 2026-02-06T12:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Price API returns currency and dimension ranges
expected: GET /api/v1/products/:id/price?width=X&height=Y with valid API key returns JSON including `currency` (ISO 4217 code), `dimensionRange` object with width/height min/max, and `unit` alongside the price.
result: pass

### 2. Draft Order REST endpoint creates checkout
expected: POST /api/v1/draft-orders with valid API key and JSON body (productId, width, height, quantity) creates a Draft Order and returns `draftOrderId` and `checkoutUrl` in the response.
result: pass

### 3. Widget package installs and builds
expected: Running `npm install` in packages/widget installs dependencies. Running `npm run build` produces ESM and UMD outputs in dist/ with TypeScript declaration file (index.d.ts).
result: pass

### 4. Widget renders dimension inputs
expected: When rendered in a React app, the widget shows two text input fields for width and height with placeholder hints showing min/max dimension range and unit suffix (e.g. "mm").
result: pass

### 5. Price updates as dimensions change
expected: After entering valid width and height values, the price updates automatically within ~400ms. A shimmer skeleton shows during loading. The price is formatted with the correct currency symbol.
result: pass

### 6. Dimension validation
expected: Entering non-numeric values or values outside the matrix range shows inline error messages on the respective input fields. Add-to-cart button is disabled when inputs are invalid.
result: pass

### 7. Quantity selector works
expected: Widget shows a quantity selector with +/- buttons. Minus button is disabled at quantity 1. Changing quantity updates the total price display.
result: pass

### 8. Add to cart creates Draft Order and redirects
expected: Clicking "Add to Cart" with valid dimensions creates a Draft Order via the API. Button shows a loading spinner during creation. After success, browser redirects to the Shopify checkout URL.
result: pass

### 9. Shadow DOM CSS isolation
expected: Widget styles do not leak to or get affected by the host page CSS. Inspecting the widget element in DevTools shows a Shadow DOM root containing the widget's own styles.
result: pass

### 10. Theme customization via props
expected: Passing a `theme` prop (e.g. `{ primaryColor: '#ff0000', borderRadius: '8px' }`) changes the widget's appearance. Colors and border radius update to match the provided theme values.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
