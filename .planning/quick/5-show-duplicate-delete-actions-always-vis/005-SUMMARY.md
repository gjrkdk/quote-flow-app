---
phase: quick-005
plan: 01
subsystem: ui/admin
tags: [ui, ux, resource-list, polaris, accessibility]
dependency_graph:
  requires: []
  provides:
    - always-visible-action-buttons
    - consistent-list-layouts
  affects:
    - app/routes/app.matrices._index.tsx
    - app/routes/app.option-groups._index.tsx
    - app/services/option-group.server.ts
tech_stack:
  added: []
  patterns:
    - ResourceList/ResourceItem with inline action buttons
    - InlineStack space-between layout for card content
key_files:
  created: []
  modified:
    - app/routes/app.matrices._index.tsx
    - app/routes/app.option-groups._index.tsx
    - app/services/option-group.server.ts
decisions:
  - title: "Always-visible buttons over hover-only shortcutActions"
    rationale: "Improves discoverability - users don't need to discover hover interactions to access core actions like duplicate and delete"
  - title: "Consistent ResourceList layout for both matrices and option groups"
    rationale: "Creates unified UX across admin list pages, making the interface more predictable and familiar"
metrics:
  duration: "131 seconds"
  completed: "2026-02-13T20:29:57Z"
  task_count: 2
  file_count: 3
  commit_count: 2
---

# Quick Task 005: Show Duplicate/Delete Actions Always Visible

**One-liner:** Replaced hover-only shortcutActions with always-visible Duplicate and Delete buttons on both matrices and option groups list pages using consistent ResourceList card layout.

## Tasks Completed

| Task | Name                                                                              | Commit  | Files                                           |
| ---- | --------------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| 1    | Replace shortcutActions with always-visible buttons on matrix cards               | 9dfcc88 | app/routes/app.matrices._index.tsx              |
| 2    | Add duplicateOptionGroup service and convert option groups list to ResourceList   | 881fe38 | app/routes/app.option-groups._index.tsx, app/services/option-group.server.ts |

## What Changed

### Matrix List Page
- **Removed:** `shortcutActions` prop on ResourceItem (hover-only behavior)
- **Added:** Always-visible Duplicate and Delete buttons inside each card
- **Layout:** InlineStack with `align="space-between"` separating content (left) from action buttons (right)
- **Implementation:** Buttons wrapped in div with `onClick={(e) => e.stopPropagation()}` to prevent card click navigation

### Option Groups List Page
- **Converted:** IndexTable condensed layout → ResourceList card layout (matching matrices page)
- **Removed:** IndexTable-specific focus management (rowRefs for table rows)
- **Added:** `duplicateOptionGroup` service function that copies option group with all choices
- **Added:** Duplicate action handler in route that redirects to edit page
- **Added:** Always-visible Duplicate and Delete buttons on each card
- **Kept:** Empty-state focus management for accessibility

### Service Layer
- **New function:** `duplicateOptionGroup(id, storeId)` in option-group.server.ts
  - Verifies ownership before duplication
  - Copies all choices with correct modifier types/values/defaults
  - Uses transaction to ensure atomic operation
  - Returns created option group with "(copy)" suffix

## User Impact

### Before
- Duplicate and Delete actions only visible on hover (desktop) or long-press (mobile)
- Option groups used condensed IndexTable (different layout from matrices)
- Users had to discover shortcutActions by hovering over cards
- No duplicate capability for option groups

### After
- Duplicate and Delete buttons always visible on every card
- Both matrices and option groups use identical ResourceList card layout
- Actions immediately discoverable without hover interaction
- Option groups can be duplicated (copies all choices, redirects to edit)
- Improved mobile UX (no hover-dependency)
- Consistent visual design across list pages

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### Layout Pattern
Both list pages now use this structure:
```tsx
<ResourceItem id={item.id} onClick={() => handleRowClick(item.id)}>
  <InlineStack align="space-between" blockAlign="center">
    <BlockStack gap="100">
      <Text variant="headingSm" fontWeight="bold">{item.name}</Text>
      <InlineStack gap="400">
        {/* metadata items */}
      </InlineStack>
    </BlockStack>
    <div onClick={(e) => e.stopPropagation()}>
      <InlineStack gap="200">
        <Button variant="plain" size="slim" onClick={handleDuplicate}>
          Duplicate
        </Button>
        <Button variant="plain" size="slim" tone="critical" onClick={handleDelete}>
          Delete
        </Button>
      </InlineStack>
    </div>
  </InlineStack>
</ResourceItem>
```

### Click Event Handling
- Card background click → navigates to edit page
- Action buttons wrapped in div with stopPropagation → prevents card click when clicking buttons
- Each button also has inline onClick handlers for their specific actions

### Duplicate Implementation
- **Matrices:** Already had duplicate functionality (copies breakpoints and cells)
- **Option Groups:** New duplicate functionality (copies choices with modifiers)
- Both redirect to `/app/{resource}/{id}/edit` after creation
- Both append "(copy)" to duplicated item name

## Verification Results

- TypeScript compilation passes (pre-existing unrelated errors remain)
- All commits created successfully
- Files modified as expected
- Service function follows existing patterns (matches deleteOptionGroup structure)
- Route action handler mirrors matrices page duplicate pattern

## Self-Check: PASSED

**Created files:** None (all modifications to existing files)

**Modified files verified:**
```
FOUND: app/routes/app.matrices._index.tsx
FOUND: app/routes/app.option-groups._index.tsx
FOUND: app/services/option-group.server.ts
```

**Commits verified:**
```
FOUND: 9dfcc88
FOUND: 881fe38
```

All task commits exist in git history and all modified files are present.
