---
phase: 12-admin-ui-option-groups
plan: 02
subsystem: admin-ui
tags:
  - forms
  - option-groups
  - dynamic-ui
  - json-serialization
  - validation
dependency_graph:
  requires:
    - "11-01: Option group validators"
    - "11-02: Option group service layer"
  provides:
    - "Create option group form with dynamic choices"
    - "Edit option group form with pre-populated data"
  affects:
    - "Option group management workflow"
tech_stack:
  added:
    - "Dynamic form fields with React state"
    - "JSON-serialized nested form data"
  patterns:
    - "Zod validation with ZodError handling"
    - "Fetcher-based form submission"
    - "Context-specific help text"
key_files:
  created:
    - path: "app/routes/app.option-groups.new.tsx"
      purpose: "Create option group form with dynamic choice management"
      loc: 289
    - path: "app/routes/app.option-groups.$id.edit.tsx"
      purpose: "Edit option group form with pre-populated data"
      loc: 366
  modified: []
decisions: []
metrics:
  duration_seconds: 133
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  commits: 2
  completed_at: "2026-02-09T21:18:46Z"
---

# Phase 12 Plan 02: Option Group Forms Summary

**One-liner:** Create and edit forms with dynamic choice management, JSON serialization, and Zod validation for option groups

## What Was Built

Created two fully functional form routes for managing option groups with their price modifier choices:

**1. Create Form (`app/routes/app.option-groups.new.tsx`)**
- Dynamic choice add/remove with 20-choice cap enforcement
- Modifier type selection (FIXED/PERCENTAGE) with context-specific help text
- Default choice checkbox (only shown for OPTIONAL groups)
- JSON serialization for nested form data
- Zod validation with error feedback via Banner
- Redirects to edit page on successful creation

**2. Edit Form (`app/routes/app.option-groups.$id.edit.tsx`)**
- Pre-populated fields from database via loader
- Same dynamic choice management as create form
- Success banner on save (stays on edit page)
- Product count displayed as informational text
- Updates via JSON with replace strategy for choices
- Full support for editing name, requirement, and all choices

## Implementation Details

**Form Structure:**
- Group name: TextField with 100 char limit
- Requirement: Select (OPTIONAL/REQUIRED)
- Dynamic choices: Array of nested Card components
- Each choice: label, modifierType, modifierValue, isDefault

**Choice Management:**
- Add: Appends new empty choice (disabled at 20)
- Remove: Filters by index (disabled when only 1 choice)
- Update: Spread-copy array, update specific field

**Form Submission:**
- Construct `{ name, requirement, choices }` object
- Serialize with `JSON.stringify`
- Submit via `fetcher.submit({ data: JSON.stringify(data) }, { method: "post" })`

**Server-Side:**
- Parse JSON from formData
- Validate with Zod schemas
- Call service layer (createOptionGroup/updateOptionGroup)
- Handle ZodError with first issue message extraction

**Validation:**
- Name: required, max 100 chars
- Choices: 1-20, labels required, modifier values as integers
- Default choice: max 1, only for OPTIONAL groups
- Requirement: REQUIRED groups cannot have default choices

## Deviations from Plan

None - plan executed exactly as written.

## Task Breakdown

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Create new option group form with dynamic choices | a818a38 | Complete |
| 2 | Create edit option group form with pre-populated data | e6607a5 | Complete |

## Verification Performed

1. TypeScript compilation: No new errors in option-group form files
2. Form structure: Both forms follow Polaris patterns
3. Dynamic choice management: Add/remove/update with 20-cap enforcement
4. JSON serialization: Nested data correctly stringified for submission
5. Zod integration: Error extraction and Banner display implemented
6. Context-specific help: Modifier value help text changes by type
7. Default checkbox: Only shown for OPTIONAL groups (requirement check)

## Files Changed

**Created:**
- `app/routes/app.option-groups.new.tsx` (289 lines)
- `app/routes/app.option-groups.$id.edit.tsx` (366 lines)

**Modified:** None

## Technical Notes

**Modifier Value Help Text:**
- FIXED: "Enter amount in cents (500 = $5.00). Negative values allowed for discounts."
- PERCENTAGE: "Enter percentage in basis points (1000 = 10%). Negative values allowed for discounts."

**Form Patterns:**
- Both forms share identical choice management logic
- Edit form pre-populates from loader, create form starts empty
- Edit form stays on same page with success banner
- Create form redirects to edit page on success

**State Management:**
- Local React state for name, requirement, choices array
- Choice type includes optional `id` field for edit form
- Update functions use useCallback for performance

## Dependencies

**Requires:**
- `app/validators/option-group.validators.ts` (OptionGroupCreateSchema, OptionGroupUpdateSchema)
- `app/services/option-group.server.ts` (createOptionGroup, getOptionGroup, updateOptionGroup)
- Polaris components (Page, Card, TextField, Select, Banner, Button, Checkbox)

**Enables:**
- Merchants can create option groups with choices
- Merchants can edit existing option groups
- Product assignment to option groups (next plan)

## Self-Check: PASSED

**Created files verified:**
```
FOUND: app/routes/app.option-groups.new.tsx
FOUND: app/routes/app.option-groups.$id.edit.tsx
```

**Commits verified:**
```
FOUND: a818a38
FOUND: e6607a5
```

**TypeScript compilation:**
- No new errors introduced
- Both form files compile successfully
- Pre-existing errors unrelated to this work

## Next Steps

Plan 03 will create the option group list view with product assignment UI, completing the admin interface for option group management.
