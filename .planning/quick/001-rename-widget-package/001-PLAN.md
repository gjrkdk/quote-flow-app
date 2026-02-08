---
phase: quick
plan: 001-rename-widget-package
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/widget/package.json
  - packages/widget/package-lock.json
  - packages/widget/README.md
  - packages/widget/vite.config.ts
  - .planning/STATE.md
  - .planning/PROJECT.md
  - .planning/MILESTONES.md
autonomous: true

must_haves:
  truths:
    - "Widget package.json name field is @gjrkdk/quote-flow"
    - "Widget builds successfully under new name"
    - "README shows correct install command and import path"
    - "Vite build output files renamed from price-matrix-widget to quote-flow"
  artifacts:
    - path: "packages/widget/package.json"
      provides: "Package identity"
      contains: "@gjrkdk/quote-flow"
    - path: "packages/widget/README.md"
      provides: "Install and usage docs"
      contains: "@gjrkdk/quote-flow"
    - path: "packages/widget/vite.config.ts"
      provides: "Build config with new output filenames"
      contains: "quote-flow"
  key_links:
    - from: "packages/widget/package.json"
      to: "npm registry"
      via: "name field determines published package name"
    - from: "packages/widget/vite.config.ts"
      to: "packages/widget/dist/"
      via: "fileName config determines output file names"
    - from: "packages/widget/package.json main/module/exports"
      to: "packages/widget/vite.config.ts fileName"
      via: "package.json entry points must match actual built file names"
---

<objective>
Rename the widget npm package from `@gjrkdk/pricing-matrix-widget` to `@gjrkdk/quote-flow`.

Purpose: Align the npm package name with the product branding (QuoteFlow).
Output: Updated widget package ready for `npm publish` under the new name.
</objective>

<execution_context>
@/Users/robinkonijnendijk/.claude/get-shit-done/workflows/execute-plan.md
@/Users/robinkonijnendijk/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/widget/package.json
@packages/widget/vite.config.ts
@packages/widget/README.md
@.planning/STATE.md
@.planning/PROJECT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename package identity and build outputs</name>
  <files>
    packages/widget/package.json
    packages/widget/vite.config.ts
  </files>
  <action>
    In `packages/widget/package.json`:
    1. Change `"name"` from `"@gjrkdk/pricing-matrix-widget"` to `"@gjrkdk/quote-flow"`
    2. Update `"main"` from `"./dist/price-matrix-widget.umd.js"` to `"./dist/quote-flow.umd.js"`
    3. Update `"module"` from `"./dist/price-matrix-widget.es.js"` to `"./dist/quote-flow.es.js"`
    4. Update `"exports"."."."import"` from `"./dist/price-matrix-widget.es.js"` to `"./dist/quote-flow.es.js"`
    5. Update `"exports"."."."require"` from `"./dist/price-matrix-widget.umd.js"` to `"./dist/quote-flow.umd.js"`
    6. Update `"description"` to: `"Drop-in React widget for Shopify dimension-based pricing with live price updates and Draft Order checkout"`
       (description is fine as-is, keep it)
    7. Update `"keywords"` — replace `"widget"` with `"quote-flow"` and keep the rest

    In `packages/widget/vite.config.ts`:
    1. Change the `name` in `build.lib` from `'PriceMatrixWidget'` to `'QuoteFlow'` (this is the UMD global name)
    2. Change the `fileName` function from `` `price-matrix-widget.${format}.js` `` to `` `quote-flow.${format}.js` ``

    Do NOT rename the React component (`PriceMatrixWidget`) or its file (`PriceMatrixWidget.tsx`) — that is a separate concern and would be a breaking API change. This task is package identity only.

    After editing, run: `cd /Users/robinkonijnendijk/Desktop/pricing-app/packages/widget && npm run build`
    Then verify the dist output files are named `quote-flow.es.js` and `quote-flow.umd.js`.
  </action>
  <verify>
    Run `cd /Users/robinkonijnendijk/Desktop/pricing-app/packages/widget && npm run build && ls dist/`
    Expected output includes: `quote-flow.es.js`, `quote-flow.umd.js`, `index.d.ts`
    Run `node -e "const p = require('./packages/widget/package.json'); console.log(p.name)"` from project root — should print `@gjrkdk/quote-flow`
  </verify>
  <done>
    - package.json name is `@gjrkdk/quote-flow`
    - main/module/exports fields point to `quote-flow.*.js` files
    - vite.config.ts produces `quote-flow.es.js` and `quote-flow.umd.js`
    - `npm run build` succeeds and dist/ contains correctly named files
  </done>
</task>

<task type="auto">
  <name>Task 2: Update README and regenerate package-lock.json</name>
  <files>
    packages/widget/README.md
    packages/widget/package-lock.json
  </files>
  <action>
    In `packages/widget/README.md`:
    1. Change the title (line 1) from `# @gjrkdk/pricing-matrix-widget` to `# @gjrkdk/quote-flow`
    2. Change the install command from `npm install @gjrkdk/pricing-matrix-widget` to `npm install @gjrkdk/quote-flow`
    3. Change the import statement from `import { PriceMatrixWidget } from '@gjrkdk/pricing-matrix-widget'` to `import { PriceMatrixWidget } from '@gjrkdk/quote-flow'`
       (Note: the component name `PriceMatrixWidget` stays the same — only the package import path changes)

    Regenerate package-lock.json:
    Run `cd /Users/robinkonijnendijk/Desktop/pricing-app/packages/widget && rm -f package-lock.json && npm install --package-lock-only`
    This ensures the lockfile reflects the new package name.
  </action>
  <verify>
    `grep -c "@gjrkdk/pricing-matrix-widget" packages/widget/README.md` returns 0
    `grep -c "@gjrkdk/quote-flow" packages/widget/README.md` returns 3 or more
    `head -3 packages/widget/package-lock.json` shows `"name": "@gjrkdk/quote-flow"`
  </verify>
  <done>
    - README title, install command, and import examples all reference `@gjrkdk/quote-flow`
    - package-lock.json reflects the new package name
    - No remaining references to `@gjrkdk/pricing-matrix-widget` in packages/widget/ (except possibly old dist files that will be overwritten on next build)
  </done>
</task>

<task type="auto">
  <name>Task 3: Update planning docs to reflect new package name</name>
  <files>
    .planning/STATE.md
    .planning/PROJECT.md
    .planning/MILESTONES.md
  </files>
  <action>
    These are planning/documentation files that reference the old package name. Update them to avoid confusion:

    In `.planning/STATE.md`:
    - Change `@gjrkdk/pricing-matrix-widget` to `@gjrkdk/quote-flow` (line ~35)

    In `.planning/PROJECT.md`:
    - Change `@gjrkdk/pricing-matrix-widget` to `@gjrkdk/quote-flow` wherever it appears (lines ~24 and ~66)

    In `.planning/MILESTONES.md`:
    - Change `@gjrkdk/pricing-matrix-widget` to `@gjrkdk/quote-flow` (line ~10)

    Do NOT update files under `.planning/phases/` — those are historical records of what happened and should preserve the original package name for accuracy.
  </action>
  <verify>
    `grep "@gjrkdk/pricing-matrix-widget" .planning/STATE.md .planning/PROJECT.md .planning/MILESTONES.md` returns no matches.
    `grep "@gjrkdk/quote-flow" .planning/STATE.md .planning/PROJECT.md .planning/MILESTONES.md` returns 4+ matches.
  </verify>
  <done>
    - STATE.md, PROJECT.md, and MILESTONES.md all reference `@gjrkdk/quote-flow`
    - Historical phase docs (under .planning/phases/) are NOT modified
  </done>
</task>

</tasks>

<verification>
1. `cd /Users/robinkonijnendijk/Desktop/pricing-app/packages/widget && npm run build` — succeeds
2. `ls packages/widget/dist/` — shows `quote-flow.es.js`, `quote-flow.umd.js`, `index.d.ts`
3. `grep -r "@gjrkdk/pricing-matrix-widget" packages/widget/package.json packages/widget/README.md .planning/STATE.md .planning/PROJECT.md .planning/MILESTONES.md` — returns no matches
4. `grep -r "@gjrkdk/quote-flow" packages/widget/package.json packages/widget/README.md` — returns matches confirming new name
</verification>

<success_criteria>
- Widget package name is `@gjrkdk/quote-flow` in package.json
- Build outputs are `quote-flow.es.js` and `quote-flow.umd.js`
- README install/import examples use `@gjrkdk/quote-flow`
- Planning docs updated to reflect new name
- Widget builds successfully with `npm run build`
</success_criteria>

<output>
After completion, create `.planning/quick/001-rename-widget-package/001-SUMMARY.md`
</output>
