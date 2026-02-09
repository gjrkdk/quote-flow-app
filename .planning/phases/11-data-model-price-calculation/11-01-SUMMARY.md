---
phase: 11-data-model-price-calculation
plan: 01
subsystem: database
tags: [schema, migration, option-groups, data-model]
dependency_graph:
  requires: [prisma-schema, postgresql-database]
  provides: [option-group-models, modifier-type-enum, group-requirement-enum]
  affects: [store-model, product-matrix-model]
tech_stack:
  added: [modifier_type-enum, group_requirement-enum, option_groups-table, option_choices-table, product_option_groups-table]
  patterns: [cascade-delete, junction-table, enum-types, manual-fk-indexes]
key_files:
  created:
    - prisma/migrations/20260209214303_add_option_groups/migration.sql
  modified:
    - prisma/schema.prisma
decisions:
  - key: "DIRECT_URL environment variable"
    choice: "Added to .env for local development"
    rationale: "Required by Prisma for schema validation in local environment (mirrors production Neon setup)"
    alternatives: ["Make directUrl optional in schema"]
    impact: "Development environment setup"
metrics:
  duration_seconds: 148
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
  completed_at: "2026-02-09T20:43:46Z"
---

# Phase 11 Plan 01: Database Schema for Option Groups Summary

**Established database foundation for option groups with three models, two enums, and proper cascade rules.**

## Tasks Completed

### Task 1: Add option group models and enums to Prisma schema
**Commit:** 2460598
**Files:** prisma/schema.prisma

Added complete schema definitions for option groups feature:
- Two enums: ModifierType (FIXED, PERCENTAGE) and GroupRequirement (REQUIRED, OPTIONAL)
- Three models: OptionGroup, OptionChoice, ProductOptionGroup
- All foreign key relationships with CASCADE delete rules
- Manual indexes on all FK columns for PostgreSQL performance
- Unique constraint on (productId, optionGroupId) to prevent duplicate assignments
- Updated Store and ProductMatrix models with new relations

**Key design decisions implemented:**
- modifierValue is required (non-nullable Int) - NULL has no semantic meaning, use 0 for zero-cost
- isDefault on OptionChoice (not defaultChoiceId on OptionGroup) - simpler, avoids cross-table FK validation
- Display order is alphabetical (no displayOrder column) per user decision
- No multi-select support (single-select only)
- Cap enforcement (20 choices per group, 5 groups per product) is application-level only

### Task 2: Generate and apply database migration
**Commit:** c9891cc
**Files:** prisma/migrations/20260209214303_add_option_groups/migration.sql

Generated and applied migration using manual workflow (prisma migrate dev doesn't work in non-interactive environment):
- Created two PostgreSQL enum types: modifier_type and group_requirement
- Created three tables: option_groups, option_choices, product_option_groups
- Added all foreign key constraints with ON DELETE CASCADE
- Created manual indexes on all foreign key columns
- Added unique constraint on (product_id, option_group_id)

Migration successfully applied - database schema is up to date.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Added DIRECT_URL to .env for schema validation**
- **Found during:** Task 1 schema validation
- **Issue:** Prisma schema validation failed because DIRECT_URL environment variable was not set in local .env file (only needed for production Neon setup)
- **Fix:** Added DIRECT_URL to .env pointing to same DATABASE_URL for local development
- **Files modified:** .env (not committed - gitignored)
- **Impact:** Allows schema validation and generation to work in local development environment

**2. [Expected] Used manual migration workflow instead of prisma migrate dev**
- **Found during:** Task 2 migration generation
- **Issue:** `prisma migrate dev` requires interactive environment
- **Fix:** Used manual workflow documented in plan: created migration directory, used `prisma migrate diff` to generate SQL, then `prisma migrate deploy` to apply
- **Outcome:** Successfully generated and applied migration

## Verification Results

All verification criteria passed:

1. `npx prisma validate` - Schema validation successful
2. `npx prisma generate` - Prisma Client generated with new types
3. Migration SQL file created with all expected structures (enums, tables, indexes, constraints)
4. `npx prisma migrate status` - Database schema is up to date
5. New types available in Prisma Client: OptionGroup, OptionChoice, ProductOptionGroup, ModifierType, GroupRequirement

## Database Structure Created

**Enums:**
- `modifier_type`: FIXED | PERCENTAGE
- `group_requirement`: REQUIRED | OPTIONAL

**Tables:**
- `option_groups`: Store-level reusable option groups
- `option_choices`: Individual choices within groups with price modifiers
- `product_option_groups`: Junction table assigning groups to products

**Cascade Rules:**
- Store deleted → OptionGroups cascade delete
- OptionGroup deleted → OptionChoices cascade delete
- OptionGroup deleted → ProductOptionGroups cascade delete
- ProductMatrix deleted → ProductOptionGroups cascade delete

**Indexes:**
- Manual FK indexes on all foreign key columns for PostgreSQL query performance
- Unique constraint on (productId, optionGroupId) prevents duplicate assignments

## Impact

**Immediate:**
- Database schema ready for option group CRUD operations
- Foundation in place for price calculation engine
- Prisma types available for TypeScript development

**Downstream Plans Unblocked:**
- Plan 02: Price Calculation Engine (depends on these models)
- Plan 03: CRUD Mutations & Queries (depends on these models)
- Future plans: Option Group UI, Widget Integration (all depend on this foundation)

**Technical Debt:**
- Pre-existing TypeScript errors in UI routes (unrelated to schema changes)
- .env now requires DIRECT_URL for local development (documented in deviation)

## Self-Check: PASSED

**Files created:**
- [FOUND] /Users/robinkonijnendijk/Desktop/quote-flow/prisma/migrations/20260209214303_add_option_groups/migration.sql

**Files modified:**
- [FOUND] /Users/robinkonijnendijk/Desktop/quote-flow/prisma/schema.prisma

**Commits:**
- [FOUND] 2460598 (Task 1: schema changes)
- [FOUND] c9891cc (Task 2: migration)

All claimed files and commits exist and are verifiable.
