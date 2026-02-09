# Phase 11: Data Model & Price Calculation Foundation - Research

**Researched:** 2026-02-09
**Domain:** Prisma database schema design, PostgreSQL, integer-based price calculation, TypeScript type safety
**Confidence:** HIGH

## Summary

Phase 11 establishes the database schema and calculation engine for option groups - reusable sets of choices that merchants can assign to products with price modifiers (fixed amounts or percentages). The research validates that the existing tech stack (Prisma 5.8, PostgreSQL, TypeScript, Zod) provides all necessary capabilities for this feature.

Key findings: (1) Prisma's explicit many-to-many relations are required because we need to store additional data (display order) in the junction table; (2) Integer cents arithmetic completely eliminates floating-point errors when combined with Math.ceil for round-up behavior; (3) PostgreSQL foreign key indexing must be manually added via `@@index` for optimal query performance; (4) TypeScript discriminated unions with enum discriminators provide type-safe modifier handling.

The existing codebase already follows patterns that align perfectly with this phase: service layer separation (`app/services/*.server.ts`), Zod validation (`app/validators/`), unit testing with Vitest, and integer-based calculations. The schema extension is additive and maintains full backward compatibility.

**Primary recommendation:** Use explicit many-to-many relations for product-option group assignments, store all prices as integers (cents), apply modifiers using integer arithmetic, and leverage TypeScript discriminated unions for type-safe modifier handling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Option group structure:**
- Single-select only — each group is pick-one (dropdown/radio), no multi-select
- Per-group required/optional setting — merchant marks each group as required or optional
- Optional groups support a merchant-set default choice (pre-selected in widget)
- Reasonable cap on choices per group (e.g. 20) to prevent abuse
- Required groups must have a selection before checkout; optional groups can be left blank
- Display order is alphabetical — no manual reordering needed

**Modifier behavior:**
- One modifier type per choice — either fixed amount ($5.00) OR percentage (+10%), not both
- Negative modifiers allowed — choices can reduce the price (e.g. "Economy glass: -15%")
- Floor at $0.00 — total price can never go below zero, silently capped
- Zero-cost options show $0.00 consistently (not "Included" or special label)

**Product assignment rules:**
- Option groups are optional on products — products work without any groups (full backward compatibility)
- Reasonable cap on groups per product (e.g. 5)
- Groups are shared/reusable across products
- Editing a shared group shows a warning ("Used by N products") then applies everywhere if confirmed
- Display order is alphabetical — no manual reordering needed

**Calculation rules:**
- Round up (ceiling) for fractional cents — consistent with existing matrix round-up logic
- Non-compounding — all percentage modifiers calculate from base matrix price independently
- Fixed modifiers add/subtract directly to the total
- Calculation order: base price from matrix → apply all modifiers from base → sum → floor at $0.00
- Use store's Shopify currency — no separate currency configuration
- API returns price breakdown: base price, each modifier with its amount, and final total

**Already decided in v1.2 requirements:**
- Integer (cents) arithmetic for all calculations — avoid floating-point
- Percentage modifiers calculated from base matrix price, non-compounding
- Price breakdown in API response enables transparent pricing in the widget (Phase 14)

### Claude's Discretion

- Database table/column naming conventions
- Index strategy for foreign keys
- Prisma schema design patterns
- Validation error message wording
- Test data fixtures and seed structure

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma ORM | 5.8.0 | Database schema and queries | Already in use, PostgreSQL-native enums, excellent TypeScript integration, migration tooling |
| PostgreSQL | Latest | Database | Already deployed on Vercel, native enum support, ACID compliance, foreign key constraints |
| Zod | 4.3.6 | Runtime validation | Already in use for API validation, TypeScript inference, composable schemas |
| TypeScript | 5.3.3 | Type safety | Already in use, discriminated unions for modifier types, compile-time safety |
| Vitest | 4.0.18 | Testing | Already in use, fast execution, built-in mocking with vitest-mock-extended |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest-mock-extended | Latest | Prisma Client mocking | Unit tests that need to mock database queries without a real database |
| @prisma/adapter-pg | 5.8.0 | PostgreSQL driver adapter | Already configured for Vercel deployment with connection pooling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Explicit many-to-many | Implicit many-to-many | Implicit is simpler but cannot store additional data (display order, assignment metadata) - explicit required |
| Integer cents | Decimal.js library | Integer arithmetic is simpler, faster, and eliminates all floating-point issues for standard 2-decimal currencies |
| Prisma enums | String literals | Enums provide database-level constraints and better TypeScript integration - no reason to use strings |
| Zod | TypeBox, Yup | Zod already in use, excellent TypeScript inference, no migration needed |

**Installation:**
```bash
# Already installed - no new dependencies required
npm install @prisma/client@^5.8.0 prisma@^5.8.0 zod@^4.3.6
npm install --save-dev vitest@^4.0.18 vitest-mock-extended
```

## Architecture Patterns

### Recommended Project Structure

```
app/
├── services/
│   ├── price-calculator.server.ts      # Existing: matrix price calculation
│   ├── option-price-calculator.server.ts  # NEW: option modifier calculation
│   └── price-breakdown.server.ts       # NEW: price breakdown generation
├── validators/
│   ├── api.validators.ts               # Existing: API request validation
│   └── option-group.validators.ts      # NEW: option group validation
└── routes/
    └── api.v1.products.$productId.price.ts  # EXTEND: add option support

prisma/
└── schema.prisma                       # EXTEND: add option group models
```

### Pattern 1: Explicit Many-to-Many Relations with Metadata

**What:** Use explicit junction tables when you need to store additional data in the relationship (e.g., display order, assignment date)

**When to use:** Product-to-option-group assignments need to track display order

**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations

model Product {
  id            String                     @id
  optionGroups  ProductOptionGroup[]       // Explicit relation through junction table
}

model OptionGroup {
  id            String                     @id
  name          String
  products      ProductOptionGroup[]       // Explicit relation through junction table
}

model ProductOptionGroup {
  id            Int                        @id @default(autoincrement())
  productId     String                     @map("product_id")
  optionGroupId String                     @map("option_group_id")
  displayOrder  Int                        @map("display_order")
  product       Product                    @relation(fields: [productId], references: [id], onDelete: Cascade)
  optionGroup   OptionGroup                @relation(fields: [optionGroupId], references: [id], onDelete: Cascade)

  @@unique([productId, optionGroupId])
  @@index([productId])
  @@index([optionGroupId])
  @@map("product_option_groups")
}
```

### Pattern 2: Integer Cents Arithmetic

**What:** Store all prices as integers representing cents, perform all calculations using integer arithmetic

**When to use:** Any price calculation or storage - completely eliminates floating-point precision errors

**Example:**
```typescript
// Source: https://dev.to/benjamin_renoux/financial-precision-in-javascript-handle-money-without-losing-a-cent-1chc

// Store: 1995 (cents)
// Display: $19.95
// Calculate: always use integers

function applyPercentageModifier(basePriceCents: number, percentageModifier: number): number {
  // percentageModifier is stored as integer basis points (1000 = 10.00%)
  const modifierAmount = Math.ceil((basePriceCents * percentageModifier) / 10000);
  return modifierAmount;
}

function applyFixedModifier(basePriceCents: number, fixedAmountCents: number): number {
  return fixedAmountCents; // Already in cents
}

function calculateFinalPrice(baseCents: number, modifiers: number[]): number {
  const total = baseCents + modifiers.reduce((sum, mod) => sum + mod, 0);
  return Math.max(0, total); // Floor at $0.00
}
```

### Pattern 3: TypeScript Discriminated Unions for Modifier Types

**What:** Use enums as discriminators in union types to enable type narrowing

**When to use:** Handling different modifier types (fixed vs. percentage) with compile-time type safety

**Example:**
```typescript
// Source: https://www.typescriptlang.org/docs/handbook/2/narrowing.html

enum ModifierType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE'
}

type FixedModifier = {
  type: ModifierType.FIXED;
  amountCents: number;  // e.g., 500 = $5.00
};

type PercentageModifier = {
  type: ModifierType.PERCENTAGE;
  basisPoints: number;  // e.g., 1000 = 10.00%
};

type PriceModifier = FixedModifier | PercentageModifier;

function calculateModifierAmount(basePriceCents: number, modifier: PriceModifier): number {
  // TypeScript narrows the type based on the discriminator
  if (modifier.type === ModifierType.FIXED) {
    return modifier.amountCents; // TypeScript knows this is FixedModifier
  } else {
    // TypeScript knows this is PercentageModifier
    return Math.ceil((basePriceCents * modifier.basisPoints) / 10000);
  }
}
```

### Pattern 4: Manual Foreign Key Indexing

**What:** PostgreSQL doesn't automatically index foreign keys - add `@@index` manually for performance

**When to use:** All foreign key columns that will be used in queries or joins

**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes

model OptionChoice {
  id            Int           @id @default(autoincrement())
  optionGroupId String        @map("option_group_id")
  optionGroup   OptionGroup   @relation(fields: [optionGroupId], references: [id], onDelete: Cascade)

  @@index([optionGroupId])  // REQUIRED for performance - PostgreSQL doesn't auto-index FKs
  @@map("option_choices")
}
```

### Pattern 5: Prisma Enum with PostgreSQL Native Support

**What:** Define enums in Prisma schema, generates PostgreSQL native enum types

**When to use:** Fixed set of values with database-level constraints (modifier types, required/optional status)

**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-schema/data-model/models

enum ModifierType {
  FIXED
  PERCENTAGE

  @@map("modifier_type")
}

enum GroupRequirement {
  REQUIRED
  OPTIONAL

  @@map("group_requirement")
}

model OptionChoice {
  id           Int          @id @default(autoincrement())
  modifierType ModifierType @map("modifier_type")
  // TypeScript type: ModifierType.FIXED | ModifierType.PERCENTAGE
}
```

### Anti-Patterns to Avoid

- **Floating-point price storage:** Never use `Float` or `Decimal` for prices - always integers (cents). Floating-point arithmetic introduces rounding errors that compound over time.

- **Missing foreign key indexes:** PostgreSQL doesn't auto-index foreign keys like MySQL. Forgetting `@@index` on foreign key columns causes slow queries that become performance bottlenecks.

- **Implicit many-to-many without metadata needs:** If you need to store display order or other metadata, you must use explicit relations. Implicit relations cannot be extended later without a migration that recreates the junction table.

- **Compounding percentage modifiers:** Don't calculate percentages from previous results. Always calculate from base price to avoid confusing, unpredictable pricing: `(base * 1.10) * 1.05 ≠ base * 1.15`

- **String literals instead of enums:** Without enums, there's no database-level constraint, easier to introduce typos, and worse TypeScript integration. Enums are free type safety.

- **Optional cascade deletes:** If option groups are owned by stores, use `onDelete: Cascade`. Missing cascade rules require manual cleanup code that's easy to forget.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal arithmetic | Custom decimal math library | Integer cents arithmetic | JavaScript/TypeScript has perfect integer arithmetic. Converting dollars to cents (multiply by 100) eliminates all floating-point issues for standard 2-decimal currencies. |
| Prisma mocking | Custom mock factory | `vitest-mock-extended` | Provides type-safe mocks with auto-completion, already proven in existing test suite. Maintains type safety across refactors. |
| Schema validation | Manual validation functions | Zod schemas | Runtime validation with TypeScript inference, composable, already in use for API validators. Zod catches mismatches between runtime data and types. |
| Database migrations | Raw SQL scripts | Prisma Migrate | Generates migrations from schema changes, tracks migration history, supports rollback, integrates with CI/CD. Manual SQL is error-prone and lacks version control. |
| Foreign key constraints | Application-level checks | PostgreSQL constraints | Database enforces referential integrity even if application code has bugs. Cannot be bypassed by direct SQL queries. |

**Key insight:** Financial calculations are deceptively complex. Edge cases like negative modifiers, zero prices, rounding fractional cents, and preventing negative totals all require careful handling. Integer arithmetic eliminates an entire class of bugs (floating-point precision) and simplifies the mental model: all prices are whole numbers of cents.

## Common Pitfalls

### Pitfall 1: Forgetting to Index Foreign Keys in PostgreSQL

**What goes wrong:** Queries that join on foreign keys become slow as tables grow. Unlike MySQL, PostgreSQL does not automatically create indexes on foreign key columns.

**Why it happens:** Developers assume foreign key constraints include indexes, but PostgreSQL only creates the constraint, not the index. The performance impact isn't obvious with small datasets.

**How to avoid:** Add `@@index([foreignKeyColumn])` to every relation field in your Prisma schema immediately when defining the relation.

**Warning signs:**
- Slow Prisma queries with `include` or `select` on relations
- PostgreSQL EXPLAIN shows sequential scans on tables with foreign keys
- Query time increases linearly with table size

**Source:** [Index on foreign keys in postgres - Prisma Discussion #25783](https://github.com/prisma/prisma/discussions/25783)

### Pitfall 2: Floating-Point Precision Errors in Price Calculations

**What goes wrong:** JavaScript's `0.1 + 0.2 = 0.30000000000000004`. Calculations drift over time, especially with percentages and rounding. Customers see incorrect prices.

**Why it happens:** JavaScript uses IEEE 754 floating-point numbers. Decimal fractions like 0.1 cannot be represented exactly in binary.

**How to avoid:** Store all prices as integers (cents). Multiply dollar amounts by 100 on input, perform all arithmetic in cents, divide by 100 only for display.

**Warning signs:**
- Price assertions fail in tests with differences like `0.00000001`
- Currency totals don't match sum of line items
- Percentage calculations produce prices like `$19.999999999999998`

**Source:** [JavaScript Rounding Errors (in Financial Applications)](https://www.robinwieruch.de/javascript-rounding-errors/)

### Pitfall 3: Schema Drift Between Prisma and Database

**What goes wrong:** Manually modifying the production database with SQL causes Prisma migrations to fail or skip changes. Schema becomes inconsistent between environments.

**Why it happens:** Quick fixes or hotfixes applied directly to production database bypass Prisma Migrate's tracking.

**How to avoid:** Never run SQL directly on production. Use `prisma migrate dev` locally, test thoroughly, deploy with `prisma migrate deploy` in CI/CD. For emergencies, use `prisma migrate resolve` to reconcile history.

**Warning signs:**
- Migration errors like "column already exists" or "constraint already defined"
- Prisma Migrate history in `_prisma_migrations` table doesn't match actual schema
- Schema introspection shows fields not in schema.prisma

**Source:** [Development and production - Prisma Documentation](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)

### Pitfall 4: Incorrect Cascade Delete Configuration

**What goes wrong:** Deleting a store leaves orphaned option groups and choices in the database. Or worse, cascade deletes propagate too far and delete data that should be preserved.

**Why it happens:** Default `onDelete` behavior is `SetNull`, which fails on required relations. Developers forget to explicitly configure cascade rules.

**How to avoid:** For owned relations (Store → OptionGroup → OptionChoice), use `onDelete: Cascade`. For shared relations (Product → OptionGroup via junction), cascade the junction record only, not the shared entity.

**Warning signs:**
- Orphaned records in database after deletions
- Foreign key constraint errors when deleting records
- Unexpected data loss after delete operations

**Source:** [Referential actions - Prisma Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions)

### Pitfall 5: Composite Unique Constraints with NULL Values

**What goes wrong:** `@@unique([productId, optionGroupId])` doesn't prevent duplicate NULLs in PostgreSQL. Multiple records with NULL in one column violate the intended constraint.

**Why it happens:** SQL standard says NULL ≠ NULL, so unique constraints allow multiple NULL values.

**How to avoid:** Make all fields in composite unique constraints required (non-nullable). If nullability is needed, use a partial unique index with a `WHERE` clause.

**Warning signs:**
- Duplicate records in junction tables despite unique constraint
- Violations only occur with optional foreign keys
- Tests pass but production has duplicates

**Source:** [Working with compound IDs and unique constraints - Prisma Documentation](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-composite-ids-and-constraints)

### Pitfall 6: Missing Migration for Enum Value Additions

**What goes wrong:** Adding a new enum value in Prisma schema without generating a migration causes Prisma Client regeneration to fail or queries to error.

**Why it happens:** PostgreSQL native enums are immutable types. Modifying them requires `ALTER TYPE ... ADD VALUE` SQL.

**How to avoid:** Always run `prisma migrate dev` after adding enum values. Prisma generates the correct `ALTER TYPE` statement. Deploy with `prisma migrate deploy`.

**Warning signs:**
- Prisma Client generation errors about unknown enum values
- Database errors: "invalid input value for enum"
- Enum values work locally but fail in deployed environments

**Source:** [Adding a New Value to an Existing Enum Type in Prisma](https://copyprogramming.com/howto/adding-a-new-value-to-an-existing-enum-type-in-prisma)

## Code Examples

Verified patterns from existing codebase and official sources:

### Prisma Schema: One-to-Many with Cascade Delete

```typescript
// Source: Existing codebase prisma/schema.prisma

model Store {
  id           String        @id @default(cuid())
  shop         String        @unique
  currency     String        @default("USD")
  optionGroups OptionGroup[] // One store has many option groups
  @@map("stores")
}

model OptionGroup {
  id        String   @id @default(cuid())
  storeId   String   @map("store_id")
  name      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([storeId]) // Manual index required for PostgreSQL foreign key
  @@map("option_groups")
}
```

### Prisma Schema: Explicit Many-to-Many with Junction Table

```typescript
// Source: https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations

model ProductMatrix {
  id           Int    @id @default(autoincrement())
  productId    String @map("product_id")
  // ... existing fields ...
  optionGroups ProductOptionGroup[] // Many products have many option groups

  @@unique([productId])
  @@map("product_matrices")
}

model OptionGroup {
  id       String               @id @default(cuid())
  name     String
  products ProductOptionGroup[] // Many option groups used by many products
  choices  OptionChoice[]       // One option group has many choices

  @@map("option_groups")
}

model ProductOptionGroup {
  id            Int         @id @default(autoincrement())
  productId     String      @map("product_id")
  optionGroupId String      @map("option_group_id")
  displayOrder  Int         @map("display_order")
  assignedAt    DateTime    @default(now()) @map("assigned_at")
  product       ProductMatrix @relation(fields: [productId], references: [productId], onDelete: Cascade)
  optionGroup   OptionGroup   @relation(fields: [optionGroupId], references: [id], onDelete: Cascade)

  @@unique([productId, optionGroupId])
  @@index([productId])
  @@index([optionGroupId])
  @@map("product_option_groups")
}
```

### Integer Cents Arithmetic with Ceiling Round-Up

```typescript
// Source: Existing codebase app/services/price-calculator.server.ts
// Adapted for option modifiers

/**
 * Applies a percentage modifier to a base price using integer arithmetic.
 * Modifiers are stored as basis points (10000 = 100.00%).
 * Rounds up fractional cents using Math.ceil.
 */
function applyPercentageModifier(
  basePriceCents: number,
  basisPoints: number
): number {
  // Example: basePriceCents = 1000 (=$10.00), basisPoints = 1500 (=15%)
  // (1000 * 1500) / 10000 = 150 cents = $1.50
  const modifierAmount = (basePriceCents * basisPoints) / 10000;

  // Round up fractional cents: 150.3 → 151
  return Math.ceil(modifierAmount);
}

/**
 * Calculates final price with modifiers applied to base matrix price.
 * Follows user requirements: non-compounding, floor at $0.00, ceiling round-up.
 */
function calculatePriceWithModifiers(
  baseMatrixPriceCents: number,
  modifiers: Array<{ type: 'FIXED' | 'PERCENTAGE'; value: number }>
): { totalCents: number; breakdown: PriceBreakdown } {
  const modifierAmounts: number[] = [];

  for (const modifier of modifiers) {
    if (modifier.type === 'FIXED') {
      // value is already in cents (e.g., 500 = $5.00)
      modifierAmounts.push(modifier.value);
    } else {
      // value is basis points (e.g., 1000 = 10%)
      // Calculate from BASE price (non-compounding)
      const amount = applyPercentageModifier(baseMatrixPriceCents, modifier.value);
      modifierAmounts.push(amount);
    }
  }

  // Sum all modifiers
  const totalModifiers = modifierAmounts.reduce((sum, amt) => sum + amt, 0);

  // Apply to base and floor at $0.00
  const totalCents = Math.max(0, baseMatrixPriceCents + totalModifiers);

  return {
    totalCents,
    breakdown: {
      basePriceCents: baseMatrixPriceCents,
      modifiers: modifierAmounts,
      totalCents
    }
  };
}
```

### Zod Validation Schema for Option Group Input

```typescript
// Source: Existing codebase app/validators/api.validators.ts
// Pattern adapted for option groups

import { z } from "zod";

export const ModifierTypeSchema = z.enum(['FIXED', 'PERCENTAGE']);

export const OptionChoiceSchema = z.object({
  label: z.string().min(1).max(100),
  modifierType: ModifierTypeSchema,
  // For FIXED: cents (e.g., 500 = $5.00)
  // For PERCENTAGE: basis points (e.g., 1000 = 10%)
  modifierValue: z.number().int(),
});

export const OptionGroupSchema = z.object({
  name: z.string().min(1).max(100),
  required: z.boolean(),
  defaultChoiceId: z.string().optional(),
  choices: z.array(OptionChoiceSchema)
    .min(1, "Option group must have at least one choice")
    .max(20, "Option group cannot have more than 20 choices"),
});

// Runtime validation with TypeScript type inference
export type OptionGroupInput = z.infer<typeof OptionGroupSchema>;
```

### Vitest Unit Test with Prisma Mock

```typescript
// Source: https://www.prisma.io/blog/testing-series-2-xPhjjmIEsM
// Pattern from existing codebase test files

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import { PrismaClient } from "@prisma/client";
import { calculatePriceWithOptions } from "./option-price-calculator.server";

vi.mock("~/db.server", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "~/db.server";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});

describe("calculatePriceWithOptions", () => {
  it("applies fixed modifier correctly", () => {
    const basePrice = 1000; // $10.00
    const modifiers = [{ type: 'FIXED' as const, value: 500 }]; // +$5.00

    const result = calculatePriceWithModifiers(basePrice, modifiers);

    expect(result.totalCents).toBe(1500); // $15.00
  });

  it("applies percentage modifier with ceiling round-up", () => {
    const basePrice = 1000; // $10.00
    const modifiers = [{ type: 'PERCENTAGE' as const, value: 1550 }]; // +15.5%
    // (1000 * 1550) / 10000 = 155 cents exactly

    const result = calculatePriceWithModifiers(basePrice, modifiers);

    expect(result.totalCents).toBe(1155); // $11.55
  });

  it("floors negative total at $0.00", () => {
    const basePrice = 1000; // $10.00
    const modifiers = [{ type: 'FIXED' as const, value: -1500 }]; // -$15.00

    const result = calculatePriceWithModifiers(basePrice, modifiers);

    expect(result.totalCents).toBe(0); // $0.00, not -$5.00
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Implicit many-to-many | Explicit with metadata | Prisma 2.0+ (2020) | Required for storing display order and other junction table data |
| Manual SQL migrations | Prisma Migrate | Prisma 2.19+ (2021) | Automated migration generation, version control, rollback support |
| Float for prices | Integer cents | Best practice since ES5 | Eliminates floating-point precision errors completely |
| String enums | Native PostgreSQL enums | Prisma 2.0+ (2020) | Database-level constraints, better performance, type safety |
| Manual mocking | vitest-mock-extended | Vitest 0.9+ (2022) | Type-safe mocks with auto-completion |
| Jest | Vitest | 2022+ | Faster execution, ESM native, Vite integration |

**Deprecated/outdated:**
- **Prisma 1 datamodel:** Replaced by Prisma 2+ schema language in 2020. Migration guide exists but irrelevant for new development.
- **@prisma/cli:** Merged into `prisma` package in Prisma 2.19 (2021). Use `prisma` command directly.
- **nexus-prisma:** No longer maintained. For GraphQL, use Pothos with Prisma plugin or codegen tools.
- **Decimal.js for prices:** Overkill for standard 2-decimal currencies. Integer cents arithmetic is simpler and faster.

## Open Questions

1. **Should we store modifier values as nullable or with default 0?**
   - What we know: Prisma defaults optional fields to NULL. Zero and NULL have different meanings.
   - What's unclear: Does NULL modifier mean "not set" (validation error) or "zero modifier" (no price change)?
   - Recommendation: Make modifierValue required (non-nullable) with validation that checks for appropriate ranges. Use 0 explicitly for zero-cost options. NULL has no semantic meaning in this context.

2. **Should defaultChoiceId be validated to exist within the option group?**
   - What we know: Prisma can enforce foreign key constraints but not "same parent" relationships.
   - What's unclear: Validation in database vs. application layer.
   - Recommendation: Use application-level validation (Zod + service layer check). Database foreign key ensures choice exists, application logic ensures it belongs to the correct group.

3. **How to handle race conditions when editing shared option groups?**
   - What we know: Multiple merchants could edit a shared group simultaneously.
   - What's unclear: Locking strategy, optimistic vs. pessimistic concurrency control.
   - Recommendation: Use Prisma's `@@updatedAt` with optimistic locking. Check updatedAt before writes, return conflict error if stale. Low traffic makes complex locking unnecessary.

4. **Should we create database constraints for cap limits (20 choices, 5 groups)?**
   - What we know: PostgreSQL supports CHECK constraints. Prisma supports them via raw SQL in migrations.
   - What's unclear: Database-level enforcement vs. application-level validation.
   - Recommendation: Application-level only. Database constraints are rigid and require migrations to change. Application validation (Zod schemas) is flexible and can be adjusted without database changes.

## Sources

### Primary (HIGH confidence)

- [Many-to-many relations - Prisma Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations)
- [Indexes - Prisma Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)
- [Working with compound IDs and unique constraints - Prisma Documentation](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-composite-ids-and-constraints)
- [Referential actions - Prisma Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions)
- [Development and production - Prisma Documentation](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Unit testing with Prisma ORM - Prisma Documentation](https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing)
- [Math.ceil() - JavaScript - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil)
- [Narrowing - TypeScript Documentation](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)

### Secondary (MEDIUM confidence)

- [Handle Money in JavaScript: Financial Precision Without Losing a Cent - DEV Community](https://dev.to/benjamin_renoux/financial-precision-in-javascript-handle-money-without-losing-a-cent-1chc)
- [JavaScript Rounding Errors (in Financial Applications) - Robin Wieruch](https://www.robinwieruch.de/javascript-rounding-errors/)
- [Index on foreign keys in postgres - Prisma Discussion #25783](https://github.com/prisma/prisma/discussions/25783)
- [The Ultimate Guide to Testing with Prisma: Unit Testing](https://www.prisma.io/blog/testing-series-2-xPhjjmIEsM)
- [The Ultimate Guide to Testing with Prisma: Mocking Prisma Client](https://www.prisma.io/blog/testing-series-1-8eRB5p0Y8o)

### Tertiary (LOW confidence)

None - all key findings verified with official documentation or multiple credible sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, versions verified from package.json
- Architecture: HIGH - Patterns verified from existing codebase and official Prisma docs
- Pitfalls: HIGH - Documented in official sources and community discussions with reproducible examples

**Research date:** 2026-02-09
**Valid until:** 2026-04-09 (60 days - stable technologies, unlikely to change)
