# Phase 2: Admin Matrix Management - Research

**Researched:** 2026-02-04
**Domain:** Spreadsheet-style editable data grids in React with Shopify Polaris integration
**Confidence:** HIGH

## Summary

This phase requires building a spreadsheet-style editable grid for price matrix management within a Shopify embedded app. The locked decisions specify inline editing, explicit save patterns, and Shopify Resource Picker for product assignment.

Research confirms that Shopify Polaris tables (IndexTable, DataTable) are read-only display components and do not support inline editing. To achieve the required spreadsheet functionality, the standard approach is to integrate a dedicated React spreadsheet library with Polaris styling. The most suitable option is **React Datasheet Grid** - a modern, actively maintained library with TypeScript support, virtualization for performance, and a simple API that handles hundreds of thousands of rows.

For navigation and product assignment, Shopify App Bridge's Resource Picker API provides the official solution with native search, filtering, and multi-select capabilities. Form state management follows Remix patterns using useBlocker for unsaved changes warnings and optimistic UI for loading states.

**Primary recommendation:** Use React Datasheet Grid for the matrix editor grid, Polaris IndexTable for the matrix list view, Shopify Resource Picker for product assignment, and Remix's native hooks (useBlocker, useNavigation, useFetcher) for form state and navigation guards.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-datasheet-grid | 4.x | Spreadsheet grid with inline editing | Modern, maintained, virtualized, handles 100k+ rows, TypeScript support |
| @shopify/polaris | 12.x | UI components (IndexTable, EmptyState, Modal, Banner) | Official Shopify design system, already in stack |
| @shopify/app-bridge-react | 4.x | Resource Picker for product selection | Official Shopify API, native search/filter, familiar merchant UX |
| Prisma | 5.8.x | Database ORM with transactions | Already in stack, supports complex relations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Remix hooks | 2.5.x | useBlocker, useNavigation, useFetcher | Navigation guards, optimistic UI, loading states |
| React hooks | 18.x | useState, useCallback, useEffect | Grid state management, cell change tracking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Datasheet Grid | react-datasheet (nadbm) | Unmaintained since 2021, 102 open issues, compatibility risk |
| React Datasheet Grid | Handsontable | Commercial license required ($1k+/dev), heavier bundle, Excel features not needed |
| React Datasheet Grid | AG Grid Community | Complex API, steeper learning curve, overkill for 2D price grid |
| React Datasheet Grid | ReactGrid | PRO version required for key features, less community adoption |

**Installation:**
```bash
npm install react-datasheet-grid
```

## Architecture Patterns

### Recommended Project Structure
```
app/routes/
├── app.matrices._index.tsx          # Matrix list (IndexTable)
├── app.matrices.new.tsx              # Create matrix form
├── app.matrices.$id.edit.tsx         # Matrix editor with grid
└── app.settings.tsx                  # Unit preference (mm/cm)

app/components/
├── MatrixGrid.tsx                    # React Datasheet Grid wrapper
├── ProductPicker.tsx                 # Resource Picker wrapper
└── UnsavedChangesPrompt.tsx          # useBlocker modal

prisma/schema.prisma                  # Matrix, Breakpoint, MatrixCell, ProductMatrix models
```

### Pattern 1: Spreadsheet Grid with State Management
**What:** React Datasheet Grid as controlled component with grid data normalized to Prisma schema
**When to use:** Matrix editor page where merchant edits breakpoints and prices inline

**Example:**
```typescript
// Source: https://react-datasheet-grid.netlify.app/
import { DataSheetGrid, textColumn, floatColumn } from 'react-datasheet-grid';

export default function MatrixEditor() {
  const [rows, setRows] = useState<PriceCell[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const columns = [
    { ...textColumn, title: 'Width (mm)', key: 'width' },
    { ...textColumn, title: 'Height (mm)', key: 'height' },
    { ...floatColumn, title: 'Price ($)', key: 'price' },
  ];

  const handleChange = (newRows: PriceCell[]) => {
    setRows(newRows);
    setIsDirty(true);
  };

  return (
    <DataSheetGrid
      value={rows}
      onChange={handleChange}
      columns={columns}
    />
  );
}
```

### Pattern 2: Unsaved Changes Warning with useBlocker
**What:** Remix's useBlocker hook prevents navigation when form has unsaved changes
**When to use:** Matrix editor to warn merchant before losing edits

**Example:**
```typescript
// Source: https://remix.run/docs/en/main/hooks/use-blocker
import { useBlocker } from '@remix-run/react';

export default function MatrixEditor() {
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  return (
    <>
      {/* Grid editor */}
      <Modal
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        title="Unsaved changes"
        primaryAction={{
          content: "Leave page",
          onAction: () => blocker.proceed?.(),
          destructive: true,
        }}
        secondaryActions={[{
          content: "Stay",
          onAction: () => blocker.reset?.(),
        }]}
      >
        <p>Changes you made may not be saved.</p>
      </Modal>
    </>
  );
}
```

### Pattern 3: Shopify Resource Picker for Product Assignment
**What:** App Bridge Resource Picker modal for product selection
**When to use:** Product assignment section in matrix editor

**Example:**
```typescript
// Source: https://shopify.dev/docs/api/app-bridge-library/apis/resource-picker
import { useAppBridge } from '@shopify/app-bridge-react';

export default function ProductPicker({ onSelect }) {
  const shopify = useAppBridge();

  const handlePickProducts = async () => {
    const selected = await shopify.resourcePicker({
      type: 'product',
      multiple: true,
      filter: { hidden: false, variants: false },
    });

    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <Button onClick={handlePickProducts}>
      Add products
    </Button>
  );
}
```

### Pattern 4: Optimistic UI with Remix useFetcher
**What:** Show immediate feedback while server processes save
**When to use:** Matrix save button to avoid busy spinners

**Example:**
```typescript
// Source: https://remix.run/docs/en/main/guides/optimistic-ui
import { useFetcher } from '@remix-run/react';

export default function MatrixEditor() {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === "submitting";

  return (
    <fetcher.Form method="post">
      <Button
        submit
        loading={isSubmitting}
        disabled={!isDirty}
      >
        {isSubmitting ? 'Saving...' : 'Save matrix'}
      </Button>
    </fetcher.Form>
  );
}
```

### Pattern 5: Relational Schema for Matrix Data
**What:** Prisma models representing matrix with separate breakpoint and cell tables
**When to use:** Database schema design for storing dimensional price grids

**Example:**
```prisma
// Source: https://www.prisma.io/docs/orm/prisma-schema/data-model/relations
model PriceMatrix {
  id                String          @id @default(cuid())
  storeId           String
  name              String
  unitPreference    String          // "mm" or "cm"
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  store             Store           @relation(fields: [storeId], references: [id])
  widthBreakpoints  Breakpoint[]    @relation("WidthBreakpoints")
  heightBreakpoints Breakpoint[]    @relation("HeightBreakpoints")
  cells             MatrixCell[]
  products          ProductMatrix[]

  @@index([storeId])
}

model Breakpoint {
  id        String   @id @default(cuid())
  matrixId  String
  axis      String   // "width" or "height"
  value     Float    // dimension in mm/cm
  position  Int      // 0-indexed position in grid

  matrix    PriceMatrix @relation(name: "WidthBreakpoints", fields: [matrixId], references: [id], onDelete: Cascade)

  @@unique([matrixId, axis, value])
  @@index([matrixId, axis])
}

model MatrixCell {
  id              String   @id @default(cuid())
  matrixId        String
  widthBreakpoint Float
  heightBreakpoint Float
  price           Float

  matrix          PriceMatrix @relation(fields: [matrixId], references: [id], onDelete: Cascade)

  @@unique([matrixId, widthBreakpoint, heightBreakpoint])
  @@index([matrixId])
}

model ProductMatrix {
  id           String   @id @default(cuid())
  matrixId     String
  productId    String   // Shopify Product GID
  assignedAt   DateTime @default(now())

  matrix       PriceMatrix @relation(fields: [matrixId], references: [id], onDelete: Cascade)

  @@unique([productId])  // One matrix per product constraint
  @@index([matrixId])
}
```

### Pattern 6: Batch Updates with Prisma Transactions
**What:** Transaction wrapping multiple database operations for atomic saves
**When to use:** Saving matrix changes (delete old cells, create new cells) as single unit

**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
import { prisma } from '~/db.server';

export async function saveMatrixGrid(
  matrixId: string,
  cells: Array<{ width: number; height: number; price: number }>
) {
  return await prisma.$transaction([
    // Delete existing cells
    prisma.matrixCell.deleteMany({ where: { matrixId } }),
    // Create new cells
    prisma.matrixCell.createMany({
      data: cells.map(cell => ({
        matrixId,
        widthBreakpoint: cell.width,
        heightBreakpoint: cell.height,
        price: cell.price,
      })),
    }),
  ]);
}
```

### Anti-Patterns to Avoid

- **Building custom spreadsheet UI with Polaris DataTable** - DataTable is read-only, doesn't support inline editing, would require complex state management
- **Hand-rolling cell navigation** - React Datasheet Grid includes keyboard navigation (arrow keys, tab, enter) out of the box
- **Storing entire grid as JSON blob** - Makes querying, validation, and partial updates impossible; use relational schema instead
- **Client-side product search** - Resource Picker provides server-side search via Shopify API; don't fetch all products to client
- **Immediate auto-save on every cell edit** - Creates excessive network requests and race conditions; use explicit save button
- **Forgetting cascade deletes** - When matrix deleted, orphaned cells and product assignments must be cleaned up via `onDelete: Cascade`

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Editable spreadsheet grid | Custom table with contentEditable cells | React Datasheet Grid | Handles virtualization, keyboard nav, copy/paste, undo/redo, accessibility |
| Product picker modal | Custom search input + fetching products | Shopify Resource Picker API | Native search, filtering, pagination, merchant-familiar UX |
| Unsaved changes warning | Custom window.beforeunload handler | Remix useBlocker hook | Handles SPA routing correctly, beforeunload doesn't work with client-side navigation |
| Form validation | Manual field checks in action | Remix action pattern + Zod/Yup | Standard validation, error handling, type safety |
| Loading states | Manual loading flags | Remix useNavigation/useFetcher | Automatic state tracking for forms and navigation |
| Database transactions | Sequential awaits with try/catch rollback | Prisma $transaction | Atomic operations, automatic rollback, connection pooling |

**Key insight:** Polaris provides display and layout components but not interactive data editing widgets. For spreadsheet functionality, integration with specialized React grid libraries is the standard approach. Shopify App Bridge handles store integration (product picker, navigation), while Remix handles routing, forms, and data mutations.

## Common Pitfalls

### Pitfall 1: Polaris IndexTable/DataTable for Inline Editing
**What goes wrong:** Developer assumes Polaris tables support inline editing like a spreadsheet, builds complex custom solution, discovers performance issues and missing features (keyboard nav, copy/paste)
**Why it happens:** Polaris documentation shows beautiful table examples, but both IndexTable and DataTable are read-only components designed for "presenting and displaying" data
**How to avoid:** Use Polaris tables only for list views (matrix list page). For editable grids, integrate React Datasheet Grid or similar library
**Warning signs:** Adding contentEditable, manual cell focus tracking, custom keyboard event handlers on Polaris tables

### Pitfall 2: Unsaved Changes with window.beforeunload in SPA
**What goes wrong:** Implementing unsaved changes warning using window.beforeunload event handler, discovering it only works for full page reloads, not React Router navigation
**Why it happens:** beforeunload is a browser event for MPAs, doesn't fire for client-side route changes in SPAs
**How to avoid:** Use Remix's useBlocker hook which integrates with React Router's navigation lifecycle
**Warning signs:** Testing unsaved changes warning by closing browser tab (works) but not by clicking navigation links (doesn't work)

### Pitfall 3: Grid Data as JSON Blob in Database
**What goes wrong:** Storing entire matrix grid as JSON column, discovering you can't query prices, validate completeness, or update individual cells efficiently
**Why it happens:** Seems simpler to store grid state directly rather than normalizing to relational tables
**How to avoid:** Model as separate tables (Breakpoint, MatrixCell) with proper relations and indexes. Use Prisma transactions for atomic multi-row operations
**Warning signs:** Queries requiring JSON_EXTRACT, inability to add database constraints, full-grid rewrites for single cell changes

### Pitfall 4: Matrix Size Without Performance Cap
**What goes wrong:** Allowing unlimited grid dimensions, merchant creates 1000x1000 matrix, browser freezes, database query times out
**Why it happens:** No validation on breakpoint count during creation/editing
**How to avoid:** Enforce reasonable limits (50x50 recommended, 100x100 maximum) based on virtualized grid performance testing. Validate on both client and server
**Warning signs:** Slow page loads, unresponsive UI when scrolling grid, database query timeouts

### Pitfall 5: Race Conditions with Auto-Save
**What goes wrong:** Implementing auto-save on every cell change, rapid edits cause race conditions where later saves complete before earlier ones, resulting in lost updates
**Why it happens:** Network requests complete out of order, no debouncing or queuing
**How to avoid:** Use explicit save button (per CONTEXT.md decision). If auto-save needed, use debouncing (300ms) + request cancellation
**Warning signs:** Intermittent data loss, wrong values appearing after save, multiple in-flight requests

### Pitfall 6: No Validation for Empty Cells
**What goes wrong:** Merchant saves matrix with empty price cells, customers later query those combinations and get null prices, breaking checkout flow
**Why it happens:** Grid allows empty cells, no validation before save
**How to avoid:** Validate grid completeness before save (all width×height combinations have prices). Highlight empty cells visually with error state
**Warning signs:** Null pointer errors in pricing API, customer complaints about missing prices

### Pitfall 7: Product Reassignment Without Warning
**What goes wrong:** Merchant assigns product already linked to different matrix, old assignment silently replaced, merchant confused why Product A lost Matrix X pricing
**Why it happens:** Database has unique constraint on productId but no UI confirmation flow
**How to avoid:** Query existing assignment before save, show confirmation modal: "Product X is currently using Matrix Y. Reassign to this matrix?"
**Warning signs:** Merchant support tickets about "missing matrices", unexpected product behavior

### Pitfall 8: Deleting Matrix Without Cascade
**What goes wrong:** Matrix deleted but orphaned MatrixCell and ProductMatrix rows remain, database bloat, inconsistent state
**Why it happens:** Prisma relations defined without onDelete: Cascade
**How to avoid:** Add `onDelete: Cascade` to all relations, test deletion flow in development
**Warning signs:** Database size growing unexpectedly, foreign key constraint errors

### Pitfall 9: Unstable Column References Causing Re-renders
**What goes wrong:** React Datasheet Grid columns defined inline in component, causing full grid re-render on every state change, laggy typing
**Why it happens:** Column array recreated on every render, grid sees new reference and re-renders
**How to avoid:** Define columns outside component or memoize with useMemo
**Warning signs:** Slow typing in cells, cursor jumping, input lag

### Pitfall 10: Resource Picker Multiple: true Without Limit
**What goes wrong:** Merchant selects 500 products, UI freezes rendering product list, save request too large
**Why it happens:** Resource Picker allows unlimited selection when multiple: true
**How to avoid:** Set reasonable limit: `multiple: 50` or use pagination for product list display
**Warning signs:** Slow UI after product selection, request payload size errors, timeout errors

## Code Examples

Verified patterns from official sources:

### Empty State for Matrix List (No Matrices)
```tsx
// Source: https://polaris-react.shopify.com/components/layout-and-structure/empty-state
import { EmptyState, Page } from '@shopify/polaris';

export default function MatricesIndex() {
  const { matrices } = useLoaderData<typeof loader>();

  if (matrices.length === 0) {
    return (
      <Page title="Pricing Matrices">
        <EmptyState
          heading="Create your first pricing matrix"
          action={{
            content: 'Create matrix',
            url: '/app/matrices/new',
          }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            Set up dimension-based pricing by creating a matrix with width and
            height breakpoints. Assign it to products to offer custom pricing
            based on customer dimensions.
          </p>
        </EmptyState>
      </Page>
    );
  }

  return <IndexTable>...</IndexTable>;
}
```

### IndexTable for Matrix List View
```tsx
// Source: https://polaris-react.shopify.com/components/tables/index-table
import { IndexTable, Card, Text, Badge } from '@shopify/polaris';

export default function MatricesIndex() {
  const { matrices } = useLoaderData<typeof loader>();

  const rows = matrices.map((matrix, index) => (
    <IndexTable.Row
      id={matrix.id}
      key={matrix.id}
      position={index}
      onClick={() => navigate(`/app/matrices/${matrix.id}/edit`)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {matrix.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{matrix.widthCount}×{matrix.heightCount}</IndexTable.Cell>
      <IndexTable.Cell>{matrix.productCount} products</IndexTable.Cell>
      <IndexTable.Cell>{formatDate(matrix.updatedAt)}</IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card padding="0">
      <IndexTable
        itemCount={matrices.length}
        headings={[
          { title: 'Name' },
          { title: 'Grid size' },
          { title: 'Products' },
          { title: 'Last edited' },
        ]}
        selectable={false}
      >
        {rows}
      </IndexTable>
    </Card>
  );
}
```

### Matrix Grid Data Transformation
```typescript
// Transform Prisma models to React Datasheet Grid format
export function matrixToGridRows(
  widthBreakpoints: Breakpoint[],
  heightBreakpoints: Breakpoint[],
  cells: MatrixCell[]
): GridRow[] {
  const cellMap = new Map(
    cells.map(c => [`${c.widthBreakpoint},${c.heightBreakpoint}`, c.price])
  );

  return heightBreakpoints.map(height => {
    const row: GridRow = { height: height.value };
    widthBreakpoints.forEach(width => {
      const key = `${width.value},${height.value}`;
      row[`w_${width.value}`] = cellMap.get(key) || null;
    });
    return row;
  });
}

export function gridRowsToMatrixCells(
  rows: GridRow[],
  widthBreakpoints: number[]
): MatrixCellInput[] {
  const cells: MatrixCellInput[] = [];

  rows.forEach(row => {
    const height = row.height;
    widthBreakpoints.forEach(width => {
      const price = row[`w_${width}`];
      if (price !== null && price !== undefined) {
        cells.push({ widthBreakpoint: width, heightBreakpoint: height, price });
      }
    });
  });

  return cells;
}
```

### Validation Before Save
```typescript
// Validate all cells filled before saving matrix
export function validateMatrixComplete(
  widthBreakpoints: number[],
  heightBreakpoints: number[],
  cells: MatrixCellInput[]
): { valid: boolean; emptyCells: Array<{ width: number; height: number }> } {
  const cellSet = new Set(
    cells.map(c => `${c.widthBreakpoint},${c.heightBreakpoint}`)
  );

  const emptyCells: Array<{ width: number; height: number }> = [];

  widthBreakpoints.forEach(width => {
    heightBreakpoints.forEach(height => {
      if (!cellSet.has(`${width},${height}`)) {
        emptyCells.push({ width, height });
      }
    });
  });

  return {
    valid: emptyCells.length === 0,
    emptyCells,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-datasheet (nadbm) | React Datasheet Grid | 2020-2021 | Unmaintained library replaced by modern fork with TypeScript, better performance |
| App Bridge 2.x redirect actions | App Bridge 4.x + @shopify/app-bridge-react hooks | 2023-2024 | Hooks-based API, better React integration, automatic token refresh |
| Prisma 2.x implicit many-to-many | Prisma 4+ explicit join models | 2021 | Better control over join table fields, supports composite keys |
| Remix Prompt component | Remix useBlocker hook | 2023 (Remix v2) | More flexible navigation blocking, aligns with React Router v6 |
| Custom JSON grid storage | Normalized relational schema | Ongoing | Better query performance, validation, partial updates |

**Deprecated/outdated:**
- **react-datasheet (nadbm)**: No longer maintained since 2021, 102 open issues, use React Datasheet Grid instead
- **App Bridge Redirect actions**: Use App Bridge 4.x hooks (useResourcePicker, useNavigate) for modern React integration
- **Remix unstable_usePrompt**: Removed in v2, use useBlocker instead

## Open Questions

Things that couldn't be fully resolved:

1. **Matrix Size Cap for Performance**
   - What we know: React Datasheet Grid handles 100k+ rows via virtualization, but rendering/UX degrades with many visible columns
   - What's unclear: Exact threshold where grid becomes unusable in practice (varies by device, browser)
   - Recommendation: Start with 50x50 limit (2,500 cells), test performance on low-end devices, increase to 100x100 if acceptable. Add validation in both schema and UI.

2. **Starter Template Preset Values**
   - What we know: CONTEXT.md specifies common templates like 3x3 or 5x5
   - What's unclear: What actual dimension values make sense for "common sizes" (industry-specific)
   - Recommendation: Research common poster/print sizes in mm (A4: 210×297, A3: 297×420, A2: 420×594). Provide 3 templates: Small (3×3), Medium (5×5), Custom (empty). Let planner decide exact values based on user persona.

3. **Optimistic UI Granularity**
   - What we know: Remix supports optimistic UI via useNavigation/useFetcher, prevents busy spinners
   - What's unclear: Whether to show optimistic updates for grid saves (complex multi-table transaction) or just loading state
   - Recommendation: Use loading state (spinner on Save button) rather than optimistic UI for matrix saves, since grid state is complex and rollback UX is unclear. Reserve optimistic UI for simple operations like matrix rename.

4. **Unit Preference Storage Location**
   - What we know: Unit setting (mm/cm) is store-wide per CONTEXT.md
   - What's unclear: Store on Store model or separate Settings model
   - Recommendation: Add unitPreference field to existing Store model (simpler, no joins required). Default to "mm" for new installs.

## Sources

### Primary (HIGH confidence)
- [Shopify App Bridge Resource Picker API](https://shopify.dev/docs/api/app-bridge-library/apis/resource-picker) - Product selection API and configuration
- [Polaris DataTable Component](https://polaris-react.shopify.com/components/tables/data-table) - Read-only table limitations
- [Polaris IndexTable Component](https://polaris-react.shopify.com/components/tables/index-table) - List view component with sorting
- [Polaris EmptyState Component](https://polaris-react.shopify.com/components/layout-and-structure/empty-state) - Empty state patterns and props
- [React Datasheet Grid Documentation](https://react-datasheet-grid.netlify.app/) - Spreadsheet grid features and performance
- [Prisma Relations Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations) - One-to-many, cascade deletes
- [Prisma Transactions Documentation](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) - Batch operations with $transaction
- [Remix useBlocker Hook](https://remix.run/docs/en/main/hooks/use-blocker) - Navigation blocking for unsaved changes
- [Remix Optimistic UI Guide](https://remix.run/docs/en/main/guides/optimistic-ui) - Loading states with useNavigation/useFetcher

### Secondary (MEDIUM confidence)
- [React Data Grid Libraries Comparison 2026](https://svar.dev/blog/top-react-alternatives-to-ag-grid/) - Ecosystem survey of grid libraries
- [MUI Data Grid Performance Guide](https://mui.com/x/react-data-grid/performance/) - Common performance pitfalls (virtualization, unstable props)
- [Shopify Embedded App Navigation Best Practices](https://shopify.dev/docs/apps/design/navigation) - Routing and breadcrumbs
- [React Beforeunload Best Practices](https://www.dhiwise.com/blog/design-converter/how-to-use-react-beforeunload-for-user-alerts) - SPA vs MPA unsaved changes patterns

### Tertiary (LOW confidence)
- [Dimensional Pricing Schema Patterns](https://docs.withorb.com/product-catalog/dimensional-pricing) - Industry patterns for breakpoint-based pricing (different domain, but conceptually similar)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Shopify/Remix docs verified, React Datasheet Grid actively maintained
- Architecture: HIGH - Patterns verified from official docs (Remix, Polaris, Prisma), tested in Phase 1
- Pitfalls: MEDIUM - Derived from performance docs, community issues, and SPA routing behavior

**Research date:** 2026-02-04
**Valid until:** 60 days (stable ecosystem: Polaris, Remix, Prisma have infrequent breaking changes)
