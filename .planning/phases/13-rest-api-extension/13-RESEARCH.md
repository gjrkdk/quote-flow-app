# Phase 13: REST API Extension - Research

**Researched:** 2026-02-10
**Domain:** REST API design, backward compatibility, Zod validation, price calculation with modifiers, Shopify Draft Orders
**Confidence:** HIGH

## Summary

Phase 13 extends the existing REST API endpoints (`/api/v1/products/:productId/price` and `/api/v1/draft-orders`) to accept optional option selections alongside dimensions, calculate modified prices using the option group modifiers from Phase 11-12, and return detailed price breakdowns. The implementation must maintain full backward compatibility—existing API clients that don't send option selections must continue working exactly as before.

The research confirms that the codebase already demonstrates all required patterns: Zod schemas for request validation with optional fields, API authentication and rate limiting, price calculation service layer, Draft Order creation with custom attributes, and error handling with RFC 7807 problem details format. The key technical challenges are: (1) validating that submitted option selections match the product's assigned option groups, (2) calculating non-compounding percentage modifiers using integer cents arithmetic (Math.ceil toward positive infinity), and (3) serializing option selections as line item metadata in Draft Orders for merchant visibility.

Key findings: (1) Optional parameters are the standard approach for backward-compatible REST API evolution—clients that don't provide them continue working unchanged; (2) Zod's `.optional()` and `.default()` methods handle optional fields elegantly with TypeScript type inference; (3) Integer cents arithmetic (already used throughout the codebase) prevents floating-point precision errors in financial calculations; (4) Shopify's DraftOrderLineItem supports `customAttributes` as key-value pairs for metadata visibility; (5) Price breakdown responses with base price and modifiers separately are standard in pricing APIs; (6) Non-compounding modifiers from base price (Phase 11 decision) simplify calculation—all modifiers apply to the matrix-calculated base price independently.

**Primary recommendation:** Follow existing API patterns (authentication, validation, error handling) and extend Zod schemas with optional `options` field as array of selection objects. Add `calculatePriceWithOptions()` service function that wraps existing `calculatePrice()` and applies modifiers sequentially. Return price breakdown in response with `basePrice`, `optionModifiers[]`, and `totalPrice` fields. Include selected options in Draft Order custom attributes array alongside existing Width/Height dimensions.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 | Request/response validation | Already in use, TypeScript-first runtime validation with `.safeParse()`, composable schemas with refinements, generates TypeScript types automatically |
| Remix | 2.5.0 | API route handlers | Already in use, provides `loader`/`action` functions, `json()` responses, error handling with catch boundaries |
| Prisma | 5.8.0 | Database queries | Already in use, type-safe ORM for fetching product option groups, supports transactions, includes() for eager loading |
| TypeScript | 5.3.3 | Type safety | Already in use, ensures type correctness across service layer and API boundaries, catches validation errors at compile time |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| exponential-backoff | 3.1.3 | Shopify API retries | Already in use in draft-order.server.ts, handles 429 rate limits with jittered exponential backoff |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Optional parameters | URL versioning (/api/v2/) | Versioning creates maintenance burden—two codepaths to maintain. Optional parameters allow single implementation with backward compatibility |
| Zod validation | AJV (JSON Schema) | AJV is faster but requires separate type definitions. Zod provides TypeScript inference from schemas, reducing duplication |
| Integer cents | Decimal libraries (Dinero.js, decimal.js) | Decimal libraries add dependencies and complexity. Integer cents (already used) is sufficient for this use case with predictable rounding |
| Custom validation | Third-party validators | Custom validation logic using Prisma queries is more flexible for business rules like "option selections must match product's assigned groups" |

**Installation:**
```bash
# No new dependencies required - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure

```
app/
├── routes/
│   ├── api.v1.products.$productId.price.ts         # EXTEND: Add option selections support
│   └── api.v1.draft-orders.ts                      # EXTEND: Add option selections support
├── services/
│   ├── price-calculator.server.ts                  # EXTEND: Add calculatePriceWithOptions()
│   ├── option-validator.server.ts                  # NEW: Validate selections match product
│   └── draft-order.server.ts                       # EXTEND: Include options in customAttributes
└── validators/
    └── api.validators.ts                            # EXTEND: Add option selection schemas
```

**Service layer pattern:** Business logic lives in `/services/` files with pure functions, API routes are thin adapters that authenticate, validate input, call services, and format responses.

### Pattern 1: Backward-Compatible Optional Parameters

**What:** Add optional fields to request schemas that default to empty/null when omitted. Existing clients that don't send the field continue working unchanged.

**When to use:** Extending existing API endpoints without breaking existing integrations.

**Example:**
```typescript
// Source: REST API backward compatibility best practices (Medium, Endgrate)

// BEFORE (Phase 11): Only dimensions required
const PriceQuerySchema = z.object({
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  quantity: z.coerce.number().int().positive().default(1),
});

// AFTER (Phase 13): Add optional options parameter
const PriceQuerySchema = z.object({
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  quantity: z.coerce.number().int().positive().default(1),
  options: z.string().optional(), // JSON-encoded array of selections
});

// In loader/action:
export async function loader({ request, params }: LoaderFunctionArgs) {
  const queryValidation = PriceQuerySchema.safeParse(queryParams);

  const { width, height, quantity, options } = queryValidation.data;

  // Parse and validate options if provided
  let parsedOptions: OptionSelection[] = [];
  if (options) {
    try {
      const optionsData = JSON.parse(options);
      const validation = OptionSelectionsSchema.safeParse(optionsData);
      if (!validation.success) {
        throw json({ error: "Invalid options format" }, { status: 400 });
      }
      parsedOptions = validation.data;
    } catch (error) {
      throw json({ error: "Invalid options JSON" }, { status: 400 });
    }
  }

  // If no options provided, existing behavior (backward compatible)
  if (parsedOptions.length === 0) {
    const basePrice = calculatePrice(width, height, matrixData);
    return json({ price: basePrice, ... });
  }

  // If options provided, calculate with modifiers
  const result = await calculatePriceWithOptions(
    width,
    height,
    matrixData,
    parsedOptions,
    productOptionGroups
  );

  return json({
    basePrice: result.basePrice,
    optionModifiers: result.modifiers,
    price: result.totalPrice,
    ...
  });
}
```

**Best practices:**
- Use `.optional()` for truly optional fields (absence is valid)
- Use `.default(value)` when you want a fallback value
- Document the optional parameter and its default behavior in API docs
- Preserve existing response format when optional parameter is omitted

**Sources:**
- [API Versioning Strategies: Backward Compatibility in REST APIs | Medium](https://medium.com/@fahimad/api-versioning-strategies-backward-compatibility-in-rest-apis-234bafd5388e)
- [API Versioning Best Practices for Backward Compatibility | Endgrate](https://endgrate.com/blog/api-versioning-best-practices-for-backward-compatibility)

### Pattern 2: Zod Schema Composition for Request Validation

**What:** Build complex validation schemas by composing smaller schemas, using `.refine()` for cross-field validation and custom business rules.

**When to use:** Validating nested structures (option selections), enforcing business rules (selections must match assigned groups), providing clear error messages.

**Example:**
```typescript
// Source: Zod documentation, existing codebase validators

// Define granular schemas
const OptionSelectionSchema = z.object({
  optionGroupId: z.string().min(1, "Option group ID required"),
  choiceId: z.string().min(1, "Choice ID required"),
});

// Compose into array schema
const OptionSelectionsSchema = z.array(OptionSelectionSchema);

// Extend existing DraftOrderSchema with optional options
const DraftOrderSchema = z.object({
  productId: z.string().refine(
    (id) => /^\d+$/.test(id) || /^gid:\/\/shopify\/Product\/\d+$/.test(id),
    { message: "Product ID must be numeric or GID format" }
  ),
  width: z.number().positive(),
  height: z.number().positive(),
  quantity: z.number().int().positive().default(1),
  options: OptionSelectionsSchema.optional(), // NEW: optional selections
});

// Usage in action:
export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const validation = DraftOrderSchema.safeParse(body);

  if (!validation.success) {
    throw json({
      type: "about:blank",
      title: "Validation Failed",
      status: 400,
      detail: "Invalid request body",
      errors: validation.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const { productId, width, height, quantity, options } = validation.data;

  // Additional validation: selections must match product's assigned groups
  if (options && options.length > 0) {
    const validationResult = await validateOptionSelections(
      normalizeProductId(productId),
      options,
      store.id
    );

    if (!validationResult.valid) {
      throw json({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        detail: validationResult.error,
      }, { status: 400 });
    }
  }

  // Proceed with calculation...
}
```

**Best practices:**
- Use `.safeParse()` instead of `.parse()` for controlled error handling
- Compose schemas from smaller reusable pieces
- Provide clear error messages in refinements
- Validate structure first (Zod), then business rules (service layer)

**Sources:**
- [How to Validate Data with Zod in TypeScript | OneUpTime](https://oneuptime.com/blog/post/2026-01-25-zod-validation-typescript/view)
- [REST API Validation Using Zod | Jeff Segovia](https://jeffsegovia.dev/blogs/rest-api-validation-using-zod)
- Existing codebase: `app/validators/api.validators.ts`, `app/validators/option-group.validators.ts`

### Pattern 3: Service Layer Business Rule Validation

**What:** Separate validation into two layers—schema validation (structure/types) in Zod, business rule validation (database constraints, relationships) in service functions.

**When to use:** Validation that requires database queries (e.g., "option selections must match product's assigned option groups").

**Example:**
```typescript
// NEW service: app/services/option-validator.server.ts

interface OptionSelection {
  optionGroupId: string;
  choiceId: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that option selections match the product's assigned option groups.
 *
 * Business rules:
 * - All selected option groups must be assigned to the product
 * - All selected choice IDs must belong to their respective option groups
 * - Required option groups must have a selection
 * - At most one selection per option group
 *
 * @param productId - Product ID (GID format)
 * @param selections - Array of option selections
 * @param storeId - Store ID for authorization
 * @returns Validation result with error message if invalid
 */
export async function validateOptionSelections(
  productId: string,
  selections: OptionSelection[],
  storeId: string
): Promise<ValidationResult> {
  // Fetch product's assigned option groups with choices
  const assignedGroups = await getProductOptionGroups(productId, storeId);

  if (!assignedGroups) {
    return {
      valid: false,
      error: "Product not found or no option groups assigned",
    };
  }

  // Build maps for efficient lookup
  const groupMap = new Map(assignedGroups.map(g => [g.id, g]));
  const choiceMap = new Map<string, Set<string>>();
  assignedGroups.forEach(group => {
    choiceMap.set(group.id, new Set(group.choices.map(c => c.id)));
  });

  // Check: all selected groups are assigned to product
  const selectedGroupIds = new Set(selections.map(s => s.optionGroupId));
  for (const groupId of selectedGroupIds) {
    if (!groupMap.has(groupId)) {
      return {
        valid: false,
        error: `Option group ${groupId} is not assigned to this product`,
      };
    }
  }

  // Check: all selected choices belong to their groups
  for (const selection of selections) {
    const validChoices = choiceMap.get(selection.optionGroupId);
    if (!validChoices || !validChoices.has(selection.choiceId)) {
      return {
        valid: false,
        error: `Choice ${selection.choiceId} does not belong to group ${selection.optionGroupId}`,
      };
    }
  }

  // Check: at most one selection per group
  const groupSelectionCounts = new Map<string, number>();
  for (const selection of selections) {
    const count = groupSelectionCounts.get(selection.optionGroupId) || 0;
    groupSelectionCounts.set(selection.optionGroupId, count + 1);
  }

  for (const [groupId, count] of groupSelectionCounts) {
    if (count > 1) {
      return {
        valid: false,
        error: `Multiple selections for option group ${groupId} (only one allowed)`,
      };
    }
  }

  // Check: required groups must have a selection
  const requiredGroups = assignedGroups.filter(g => g.requirement === "REQUIRED");
  for (const group of requiredGroups) {
    if (!selectedGroupIds.has(group.id)) {
      return {
        valid: false,
        error: `Required option group "${group.name}" must have a selection`,
      };
    }
  }

  return { valid: true };
}
```

**Best practices:**
- Keep Zod schemas focused on structure (types, required/optional, formats)
- Move database-dependent validation to service layer
- Return descriptive error messages that reference user-facing labels (group names)
- Use efficient data structures (Maps, Sets) for validation with large datasets

**Sources:**
- Existing codebase pattern: `app/services/option-group.server.ts` (ownership validation)
- [Mastering Zod Validation | Codeminer42](https://blog.codeminer42.com/zod-validation-101/)

### Pattern 4: Non-Compounding Modifier Calculation with Integer Cents

**What:** Apply price modifiers sequentially from the base price (not compounding), using integer cents arithmetic to avoid floating-point precision errors, with Math.ceil rounding for percentages.

**When to use:** Calculating option-modified prices where modifiers don't stack (Phase 11 decision).

**Example:**
```typescript
// EXTEND: app/services/price-calculator.server.ts

interface OptionModifier {
  optionGroupName: string;
  choiceLabel: string;
  modifierType: "FIXED" | "PERCENTAGE";
  modifierValue: number; // FIXED: cents, PERCENTAGE: basis points
  appliedAmount: number; // cents
}

interface PriceWithOptionsResult {
  basePrice: number; // cents
  modifiers: OptionModifier[];
  totalPrice: number; // cents
}

/**
 * Calculates price with option modifiers applied.
 *
 * Calculation rules (from Phase 11):
 * - Base price from matrix (calculatePrice) in cents
 * - All modifiers apply to base price independently (non-compounding)
 * - FIXED modifiers: direct addition/subtraction in cents
 * - PERCENTAGE modifiers: (basePrice * basisPoints / 10000), Math.ceil rounding
 * - Sum all modifier amounts and add to base price
 *
 * @param width - Customer width dimension
 * @param height - Customer height dimension
 * @param matrixData - Matrix with breakpoints and price cells
 * @param selections - Validated option selections
 * @param optionGroups - Product's assigned option groups with choices
 * @returns Price breakdown with base, modifiers, and total
 */
export async function calculatePriceWithOptions(
  width: number,
  height: number,
  matrixData: MatrixData,
  selections: OptionSelection[],
  optionGroups: Array<{
    id: string;
    name: string;
    choices: Array<{
      id: string;
      label: string;
      modifierType: "FIXED" | "PERCENTAGE";
      modifierValue: number;
    }>;
  }>
): Promise<PriceWithOptionsResult> {
  // Calculate base price from matrix (existing function)
  const basePrice = calculatePrice(width, height, matrixData);

  // If no selections, return base price only
  if (selections.length === 0) {
    return {
      basePrice,
      modifiers: [],
      totalPrice: basePrice,
    };
  }

  // Build choice lookup map
  const choiceMap = new Map<string, {
    groupName: string;
    label: string;
    modifierType: "FIXED" | "PERCENTAGE";
    modifierValue: number;
  }>();

  for (const group of optionGroups) {
    for (const choice of group.choices) {
      choiceMap.set(choice.id, {
        groupName: group.name,
        label: choice.label,
        modifierType: choice.modifierType,
        modifierValue: choice.modifierValue,
      });
    }
  }

  // Apply modifiers (non-compounding from base price)
  const modifiers: OptionModifier[] = [];
  let totalModifierAmount = 0;

  for (const selection of selections) {
    const choice = choiceMap.get(selection.choiceId);
    if (!choice) continue; // Should not happen after validation

    let appliedAmount: number;

    if (choice.modifierType === "FIXED") {
      // FIXED: direct cents value
      appliedAmount = choice.modifierValue;
    } else {
      // PERCENTAGE: (basePrice * basisPoints / 10000), Math.ceil rounding
      // Basis points: 1000 = 10%, 500 = 5%, -1000 = -10%
      const percentage = choice.modifierValue / 10000;
      const rawAmount = basePrice * percentage;

      // Ceiling rounding (toward positive infinity)
      appliedAmount = Math.ceil(rawAmount);
    }

    modifiers.push({
      optionGroupName: choice.groupName,
      choiceLabel: choice.label,
      modifierType: choice.modifierType,
      modifierValue: choice.modifierValue,
      appliedAmount,
    });

    totalModifierAmount += appliedAmount;
  }

  const totalPrice = basePrice + totalModifierAmount;

  return {
    basePrice,
    modifiers,
    totalPrice,
  };
}
```

**Why integer cents:**
- Floating-point representation cannot exactly represent many decimal fractions (e.g., 0.1)
- Of multiples of 0.01 between 0 and 1, only 0, 0.25, 0.5, 0.75, and 1 are exact in IEEE-754
- Integer cents provide exact representation with no rounding errors
- Already used throughout the codebase (prices stored as floats but represent cents)

**Why Math.ceil for percentages:**
- Phase 11 decision: ceiling rounding toward positive infinity
- Predictable, merchant-friendly (never undercharges)
- Simple implementation (no banker's rounding complexity)

**Sources:**
- [Floats Don't Work For Storing Cents | Modern Treasury](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents)
- [Precision Matters: Using Cents Instead of Floating Point | HackerOne](https://www.hackerone.com/blog/precision-matters-why-using-cents-instead-floating-point-transaction-amounts-crucial)
- Existing codebase: `app/services/price-calculator.server.ts` (all prices in cents)

### Pattern 5: Price Breakdown Response Format

**What:** Return detailed price breakdown showing base price and individual modifiers separately, allowing clients to display itemized pricing.

**When to use:** Pricing APIs where transparency is important, especially for options/add-ons.

**Example:**
```typescript
// EXTEND: app/routes/api.v1.products.$productId.price.ts

// Response format WITHOUT options (backward compatible):
{
  "price": 2500,           // Unit price in cents
  "currency": "USD",
  "dimensions": {
    "width": 100,
    "height": 150,
    "unit": "cm"
  },
  "quantity": 1,
  "total": 2500,
  "matrix": "Standard Glass Pricing",
  "dimensionRange": {
    "widthMin": 50,
    "widthMax": 200,
    "heightMin": 50,
    "heightMax": 300
  }
}

// Response format WITH options (extended):
{
  "basePrice": 2500,       // NEW: Base price from matrix
  "optionModifiers": [     // NEW: Array of applied modifiers
    {
      "optionGroup": "Frame Material",
      "choice": "Premium Aluminum",
      "modifierType": "FIXED",
      "modifierValue": 500,
      "appliedAmount": 500
    },
    {
      "optionGroup": "Glass Type",
      "choice": "Anti-Glare Coating",
      "modifierType": "PERCENTAGE",
      "modifierValue": 1000,  // 10% in basis points
      "appliedAmount": 250    // Math.ceil(2500 * 0.10)
    }
  ],
  "price": 3250,           // Unit price with modifiers
  "currency": "USD",
  "dimensions": {
    "width": 100,
    "height": 150,
    "unit": "cm"
  },
  "quantity": 1,
  "total": 3250,           // Total price (price * quantity)
  "matrix": "Standard Glass Pricing",
  "dimensionRange": {
    "widthMin": 50,
    "widthMax": 200,
    "heightMin": 50,
    "heightMax": 300
  }
}
```

**Best practices:**
- When options are provided, include `basePrice` and `optionModifiers` in response
- When options are omitted, keep response format unchanged (backward compatible)
- Use clear field names: `basePrice` (before modifiers), `price` (after modifiers), `total` (price * quantity)
- Include both `modifierValue` (input) and `appliedAmount` (calculated) for transparency
- Express all prices in same unit (cents) consistently

**Sources:**
- Azure Retail Prices REST API pattern
- Existing codebase: `app/routes/api.v1.products.$productId.price.ts`

### Pattern 6: Draft Order Line Item Custom Attributes

**What:** Include option selections as custom attributes on Draft Order line items for merchant visibility in Shopify admin.

**When to use:** When creating Draft Orders with product customizations that merchants need to see.

**Example:**
```typescript
// EXTEND: app/services/draft-order.server.ts

export interface SubmitDraftOrderInput {
  admin: any;
  storeId: string;
  matrixId: string;
  productId: string;
  productTitle: string;
  width: number;
  height: number;
  quantity: number;
  unitPrice: number;
  unit: string;
  options?: Array<{          // NEW: optional selections
    optionGroupName: string;
    choiceLabel: string;
  }>;
}

export async function submitDraftOrder(
  input: SubmitDraftOrderInput
): Promise<CreateDraftOrderResult> {
  const {
    admin,
    storeId,
    matrixId,
    productId,
    productTitle,
    width,
    height,
    quantity,
    unitPrice,
    unit,
    options,
  } = input;

  const widthDisplay = formatDimension(width, unit);
  const heightDisplay = formatDimension(height, unit);

  // Build custom attributes array
  const customAttributes = [
    { key: "Width", value: widthDisplay },
    { key: "Height", value: heightDisplay },
  ];

  // Add option selections to custom attributes
  if (options && options.length > 0) {
    for (const option of options) {
      customAttributes.push({
        key: option.optionGroupName,
        value: option.choiceLabel,
      });
    }
  }

  // Create Draft Order via GraphQL
  const draftOrderInput = {
    lineItems: [
      {
        title: productTitle,
        quantity,
        originalUnitPrice: unitPrice,
        customAttributes, // Include width, height, and options
      },
    ],
    tags: ["price-matrix"],
  };

  // ... rest of submitDraftOrder logic
}
```

**Shopify custom attributes:**
- DraftOrderLineItem supports `customAttributes` as array of `{ key, value }` pairs
- Displayed in Shopify admin for merchant visibility
- Limitation: Multiple attributes with identical key names can't be saved (not an issue for this use case—one selection per group)
- Stored alongside line item, visible in order details

**Best practices:**
- Use descriptive keys (option group names) not IDs
- Use human-readable values (choice labels) not IDs
- Keep custom attributes for display only (don't rely on them for calculations)
- Maintain consistent key naming (capitalize for consistency with "Width", "Height")

**Sources:**
- [DraftOrderLineItem - GraphQL Admin | Shopify](https://shopify.dev/docs/api/admin-graphql/latest/objects/DraftOrderLineItem)
- [draftOrderCreate mutation | Shopify](https://shopify.dev/docs/api/admin-graphql/unstable/mutations/draftordercreate)
- Existing codebase: `app/services/draft-order.server.ts` (custom attributes for dimensions)

### Anti-Patterns to Avoid

- **URL versioning for minor additions:** Don't create `/api/v2/` endpoints for backward-compatible changes. URL versioning creates maintenance burden (two codepaths). Use optional parameters instead.

- **Floating-point arithmetic for money:** Don't use `price * 0.10` for percentage calculations. Floating-point has precision errors (0.1 + 0.2 !== 0.3). Use integer cents with basis points (`Math.ceil(price * basisPoints / 10000)`).

- **Compounding modifiers:** Don't apply modifiers sequentially where each affects the next (e.g., 10% then another 10% = 21% total). Phase 11 decision: all modifiers apply to base price independently (non-compounding) for predictable calculations.

- **Validating business rules in Zod refinements:** Don't put database queries in Zod `.refine()` callbacks. Zod is for schema validation (structure/types). Database-dependent validation belongs in service layer.

- **Exposing internal IDs in error messages:** Don't return Prisma auto-increment IDs in API errors. Use natural keys (product GID, option group names) or generic messages. Internal IDs leak implementation details.

- **Missing backward compatibility testing:** Don't assume optional parameters maintain compatibility. Test existing API clients (without new parameters) still work exactly as before.

- **Ignoring required vs optional group validation:** Don't accept option selections without checking required groups have selections. Required groups mandate a selection, optional groups allow omission (with default or no modifier).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Custom validators | Zod schemas | Already in use, TypeScript type inference, composable, better error messages, community standard |
| Money calculations | Custom decimal class | Integer cents arithmetic | Simpler, no dependencies, exact precision, already used throughout codebase |
| API authentication | Custom token system | Existing authenticateApiKey | Already implemented with API key hashing, rate limiting, store validation |
| Error responses | Custom error format | RFC 7807 problem details | Already used (type, title, status, detail fields), industry standard, client-friendly |
| Retry logic | Custom retry loops | exponential-backoff library | Already in use for Shopify API calls, handles 429s with jittered backoff, battle-tested |
| Draft Order creation | Direct GraphQL calls | submitDraftOrder service | Already implemented with retries, error handling, local record keeping, shared by admin UI and REST API |

**Key insight:** The codebase already has robust patterns for all Phase 13 requirements. This phase is about extending existing systems (add optional parameters, extend calculators, augment responses) rather than building new infrastructure. Follow established patterns for consistency and maintainability.

## Common Pitfalls

### Pitfall 1: Breaking Backward Compatibility with Response Changes

**What goes wrong:** Adding new fields to API responses in a way that breaks existing clients expecting specific structure (e.g., changing `price` field to `totalPrice` without keeping `price` for compatibility).

**Why it happens:** Developer focuses on new feature requirements and overlooks existing client expectations.

**How to avoid:**
- When options are omitted, return exact same response format as Phase 11
- When options are provided, add NEW fields (`basePrice`, `optionModifiers`) but keep existing fields (`price`, `total`)
- Test with and without optional parameters to verify compatibility
- Document that `price` is now "unit price after modifiers" when options are present

**Warning signs:**
- Removing or renaming existing response fields
- Changing field types (e.g., price from number to object)
- Reordering fields in a way that breaks strict parsers
- Clients report "unexpected field" or "missing field" errors

**Example of correct approach:**
```typescript
// BEFORE (Phase 11):
return json({
  price: unitPrice,    // Keep this field
  total: total,        // Keep this field
  currency: currency,
  // ... other fields
});

// AFTER (Phase 13) with options:
return json({
  basePrice: basePrice,      // NEW field
  optionModifiers: mods,     // NEW field
  price: modifiedPrice,      // KEEP field (now with modifiers)
  total: total,              // KEEP field
  currency: currency,
  // ... other fields
});

// AFTER (Phase 13) without options:
return json({
  price: unitPrice,    // Same as Phase 11
  total: total,        // Same as Phase 11
  currency: currency,
  // ... other fields - exact same response
});
```

### Pitfall 2: Insufficient Option Selection Validation

**What goes wrong:** API accepts invalid option selections (wrong group, wrong choice, missing required selections) and either crashes during calculation or returns incorrect prices.

**Why it happens:** Developer validates schema structure but skips business rule validation against database.

**How to avoid:**
- Implement comprehensive `validateOptionSelections()` service function
- Check: selected groups are assigned to product
- Check: selected choices belong to their groups
- Check: at most one selection per group
- Check: required groups have selections
- Return descriptive errors with group/choice names (not IDs)

**Warning signs:**
- API crashes with "choice not found" during calculation
- Clients can select options from unassigned groups
- Multiple selections per group are accepted
- Required groups can be skipped without error
- Error messages reference internal IDs instead of names

**Example validation checklist:**
```typescript
// Validation checklist:
const validationChecks = {
  productExists: "Product not found or no option groups assigned",
  groupsAssigned: "Option group X is not assigned to this product",
  choicesBelong: "Choice Y does not belong to group X",
  onePerGroup: "Multiple selections for group X (only one allowed)",
  requiredSelected: "Required option group 'Material' must have a selection",
};
```

### Pitfall 3: Floating-Point Precision Errors in Percentage Calculations

**What goes wrong:** Using `price * 0.10` for percentages introduces precision errors (0.1 + 0.2 = 0.30000000000000004), causing off-by-one-cent discrepancies.

**Why it happens:** Developer uses natural decimal notation instead of integer basis points.

**How to avoid:**
- Store percentage modifiers as basis points (1000 = 10%, 500 = 5%)
- Calculate: `Math.ceil(basePrice * basisPoints / 10000)`
- All prices in cents (integers)
- Use Math.ceil for rounding toward positive infinity (Phase 11 decision)

**Warning signs:**
- Prices ending in weird fractions (e.g., $25.000000000000004)
- Off-by-one-cent errors in calculations
- Rounding inconsistencies between runs
- Floating-point numbers in price calculations

**Example of correct approach:**
```typescript
// WRONG: Floating-point percentage
const discount = price * 0.10;  // Precision error
const discountedPrice = price - discount;

// CORRECT: Integer basis points
const basisPoints = 1000; // 10%
const discountAmount = Math.ceil(price * basisPoints / 10000);
const discountedPrice = price - discountAmount;  // All integers, exact
```

**Sources:**
- [Floats Don't Work For Storing Cents | Modern Treasury](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents)
- [Floating-Point Numbers and Money | Medium](https://medium.com/@Tom1212121/floating-point-numbers-and-money-a433b326396f)

### Pitfall 4: Forgetting Default Choices for Optional Groups

**What goes wrong:** Optional groups with default choices are ignored when no selection is provided, resulting in incorrect price (missing default modifier).

**Why it happens:** Developer assumes "no selection = no modifier" without considering default choices.

**How to avoid:**
- When validating selections, identify optional groups with defaults that weren't selected
- If optional group has default choice and no selection provided, treat as if default was selected
- Include default choice in modifiers array with note "default applied"
- Document this behavior in API documentation

**Warning signs:**
- Prices differ when option is explicitly selected vs. omitted (for optional with default)
- Merchants report incorrect prices when customers don't select optional groups
- Default choice modifiers are never applied

**Example handling:**
```typescript
// After validating explicit selections, apply defaults for omitted optional groups

const selectedGroupIds = new Set(selections.map(s => s.optionGroupId));

for (const group of optionGroups) {
  // Skip if already has a selection
  if (selectedGroupIds.has(group.id)) continue;

  // Optional group with default choice
  if (group.requirement === "OPTIONAL") {
    const defaultChoice = group.choices.find(c => c.isDefault);
    if (defaultChoice) {
      // Apply default choice as if it was selected
      selections.push({
        optionGroupId: group.id,
        choiceId: defaultChoice.id,
      });
    }
  }
  // Required groups without selection already caught by validation
}
```

### Pitfall 5: Incorrect Query Parameter Encoding for Arrays/Objects

**What goes wrong:** GET endpoint tries to accept option selections as query parameters with complex encoding (e.g., `?options[0][groupId]=...&options[0][choiceId]=...`) which becomes verbose and error-prone.

**Why it happens:** Developer treats GET endpoint like POST with complex body, forgetting query parameters should be simple.

**How to avoid:**
- For GET endpoint: use JSON-encoded string in single query parameter (`?options={"selections":[...]}`)
- Parse JSON string in loader with try-catch, validate with Zod
- For POST endpoint: use JSON request body (already correct pattern)
- Document that GET endpoint requires URL-encoded JSON for options parameter

**Warning signs:**
- Query strings become extremely long and complex
- URL encoding issues with special characters
- Clients struggle to construct correct query parameters
- Different clients encode arrays differently (PHP vs. JavaScript conventions)

**Example correct approach:**
```typescript
// GET /api/v1/products/:productId/price?width=100&height=150&options={"selections":[{"optionGroupId":"...","choiceId":"..."}]}

const url = new URL(request.url);
const optionsParam = url.searchParams.get("options");

if (optionsParam) {
  try {
    const optionsData = JSON.parse(optionsParam);
    const validation = OptionSelectionsSchema.safeParse(optionsData);
    // ... validate and use
  } catch (error) {
    // Invalid JSON
  }
}
```

### Pitfall 6: Missing Custom Attributes in Draft Order Local Records

**What goes wrong:** Option selections are included in Shopify Draft Order custom attributes but not stored in local DraftOrderRecord table, making it impossible to query or report on option usage.

**Why it happens:** Developer focuses on Shopify visibility but forgets local record keeping for analytics.

**How to avoid:**
- Extend DraftOrderRecord table with optional JSON field for option selections
- Store selections array when creating local record
- Enable querying: "Which products use option X?", "How often is choice Y selected?"
- Consider analytics requirements early in implementation

**Warning signs:**
- Can't answer questions about option usage
- No way to generate reports on popular choices
- Data exists in Shopify but not in local database
- Missing audit trail for option selections

**Example schema extension:**
```prisma
model DraftOrderRecord {
  id                  Int         @id @default(autoincrement())
  // ... existing fields
  optionSelections    Json?       @map("option_selections") // NEW
  // Stores: [{"groupId": "...", "groupName": "...", "choiceId": "...", "choiceLabel": "..."}]
}
```

## Code Examples

Verified patterns from existing codebase and official sources:

### Extended Price Endpoint Request Validation

```typescript
// EXTEND: app/validators/api.validators.ts

/**
 * Validates option selection in request.
 */
export const OptionSelectionSchema = z.object({
  optionGroupId: z.string().min(1, "Option group ID is required"),
  choiceId: z.string().min(1, "Choice ID is required"),
});

/**
 * Validates array of option selections.
 */
export const OptionSelectionsSchema = z.object({
  selections: z
    .array(OptionSelectionSchema)
    .max(5, "Maximum 5 option selections (product limit)"),
});

/**
 * Extends PriceQuerySchema with optional options parameter.
 * Backward compatible: options is optional, defaults to no selections.
 */
export const PriceQuerySchemaExtended = z.object({
  width: z.coerce.number().positive("Width must be a positive number"),
  height: z.coerce.number().positive("Height must be a positive number"),
  quantity: z.coerce.number().int().positive().default(1),
  options: z.string().optional(), // JSON-encoded OptionSelectionsSchema
});

/**
 * Extends DraftOrderSchema with optional options array.
 * Backward compatible: options is optional, defaults to empty array.
 */
export const DraftOrderSchemaExtended = z.object({
  productId: z.string().refine(
    (id) => /^\d+$/.test(id) || /^gid:\/\/shopify\/Product\/\d+$/.test(id),
    { message: "Product ID must be numeric or GID format" }
  ),
  width: z.number().positive("Width must be a positive number"),
  height: z.number().positive("Height must be a positive number"),
  quantity: z.number().int().positive().default(1),
  options: z
    .array(OptionSelectionSchema)
    .max(5, "Maximum 5 option selections")
    .optional(),
});
```

### Price Calculation with Options

```typescript
// EXTEND: app/services/price-calculator.server.ts

export interface OptionSelection {
  optionGroupId: string;
  choiceId: string;
}

export interface OptionModifier {
  optionGroupName: string;
  choiceLabel: string;
  modifierType: "FIXED" | "PERCENTAGE";
  modifierValue: number;
  appliedAmount: number;
}

export interface PriceWithOptionsResult {
  basePrice: number;
  modifiers: OptionModifier[];
  totalPrice: number;
}

/**
 * Calculates price with option modifiers applied.
 *
 * @param width - Width dimension
 * @param height - Height dimension
 * @param matrixData - Price matrix data
 * @param selections - Option selections (after validation)
 * @param optionGroups - Product's option groups with choices
 * @returns Price breakdown with base, modifiers, and total
 */
export function calculatePriceWithOptions(
  width: number,
  height: number,
  matrixData: MatrixData,
  selections: OptionSelection[],
  optionGroups: Array<{
    id: string;
    name: string;
    requirement: string;
    choices: Array<{
      id: string;
      label: string;
      modifierType: string;
      modifierValue: number;
      isDefault: boolean;
    }>;
  }>
): PriceWithOptionsResult {
  // Calculate base price from matrix
  const basePrice = calculatePrice(width, height, matrixData);

  // Apply defaults for optional groups without explicit selections
  const selectedGroupIds = new Set(selections.map(s => s.optionGroupId));
  const effectiveSelections = [...selections];

  for (const group of optionGroups) {
    if (selectedGroupIds.has(group.id)) continue;

    if (group.requirement === "OPTIONAL") {
      const defaultChoice = group.choices.find(c => c.isDefault);
      if (defaultChoice) {
        effectiveSelections.push({
          optionGroupId: group.id,
          choiceId: defaultChoice.id,
        });
      }
    }
  }

  // Build choice lookup
  const choiceMap = new Map<string, {
    groupName: string;
    label: string;
    modifierType: "FIXED" | "PERCENTAGE";
    modifierValue: number;
  }>();

  for (const group of optionGroups) {
    for (const choice of group.choices) {
      choiceMap.set(choice.id, {
        groupName: group.name,
        label: choice.label,
        modifierType: choice.modifierType as "FIXED" | "PERCENTAGE",
        modifierValue: choice.modifierValue,
      });
    }
  }

  // Calculate modifiers (non-compounding from base price)
  const modifiers: OptionModifier[] = [];
  let totalModifierAmount = 0;

  for (const selection of effectiveSelections) {
    const choice = choiceMap.get(selection.choiceId);
    if (!choice) continue;

    let appliedAmount: number;

    if (choice.modifierType === "FIXED") {
      appliedAmount = choice.modifierValue;
    } else {
      // PERCENTAGE: basis points (1000 = 10%)
      const rawAmount = (basePrice * choice.modifierValue) / 10000;
      appliedAmount = Math.ceil(rawAmount); // Ceiling rounding
    }

    modifiers.push({
      optionGroupName: choice.groupName,
      choiceLabel: choice.label,
      modifierType: choice.modifierType,
      modifierValue: choice.modifierValue,
      appliedAmount,
    });

    totalModifierAmount += appliedAmount;
  }

  return {
    basePrice,
    modifiers,
    totalPrice: basePrice + totalModifierAmount,
  };
}
```

### Extended Price Endpoint Loader

```typescript
// EXTEND: app/routes/api.v1.products.$productId.price.ts

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  try {
    const store = await authenticateApiKey(request);
    checkRateLimit(store.id);

    const productIdValidation = ProductIdSchema.safeParse(params.productId);
    if (!productIdValidation.success) {
      throw json(
        { type: "about:blank", title: "Bad Request", status: 400, detail: "Invalid product ID" },
        { status: 400 }
      );
    }
    const normalizedProductId = normalizeProductId(productIdValidation.data);

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};
    const widthParam = url.searchParams.get("width");
    const heightParam = url.searchParams.get("height");
    const quantityParam = url.searchParams.get("quantity");
    const optionsParam = url.searchParams.get("options");

    if (widthParam !== null) queryParams.width = widthParam;
    if (heightParam !== null) queryParams.height = heightParam;
    if (quantityParam !== null) queryParams.quantity = quantityParam;
    if (optionsParam !== null) queryParams.options = optionsParam;

    const queryValidation = PriceQuerySchemaExtended.safeParse(queryParams);
    if (!queryValidation.success) {
      throw json(
        {
          type: "about:blank",
          title: "Validation Failed",
          status: 400,
          detail: "Invalid query parameters",
          errors: queryValidation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { width, height, quantity, options } = queryValidation.data;

    // Validate dimensions
    const dimensionValidation = validateDimensions(width, height, quantity);
    if (!dimensionValidation.valid) {
      throw json(
        { type: "about:blank", title: "Bad Request", status: 400, detail: dimensionValidation.error },
        { status: 400 }
      );
    }

    // Look up product matrix
    const productMatrix = await lookupProductMatrix(normalizedProductId, store.id);
    if (!productMatrix) {
      throw json(
        { type: "about:blank", title: "Not Found", status: 404, detail: "No price matrix assigned" },
        { status: 404 }
      );
    }

    // Parse and validate option selections if provided
    let parsedOptions: OptionSelection[] = [];
    if (options) {
      try {
        const optionsData = JSON.parse(options);
        const optionsValidation = OptionSelectionsSchema.safeParse(optionsData);
        if (!optionsValidation.success) {
          throw json(
            {
              type: "about:blank",
              title: "Validation Failed",
              status: 400,
              detail: "Invalid options format",
              errors: optionsValidation.error.flatten().fieldErrors,
            },
            { status: 400 }
          );
        }
        parsedOptions = optionsValidation.data.selections;
      } catch (error) {
        if (error instanceof Response) throw error;
        throw json(
          { type: "about:blank", title: "Bad Request", status: 400, detail: "Invalid options JSON" },
          { status: 400 }
        );
      }
    }

    // If options provided, fetch and validate against product's assigned groups
    let optionGroups: any[] = [];
    if (parsedOptions.length > 0) {
      optionGroups = await getProductOptionGroups(normalizedProductId, store.id);
      if (!optionGroups || optionGroups.length === 0) {
        throw json(
          { type: "about:blank", title: "Bad Request", status: 400, detail: "No option groups assigned to product" },
          { status: 400 }
        );
      }

      const validation = await validateOptionSelections(normalizedProductId, parsedOptions, store.id);
      if (!validation.valid) {
        throw json(
          { type: "about:blank", title: "Bad Request", status: 400, detail: validation.error },
          { status: 400 }
        );
      }
    }

    // Calculate price
    let result: any;
    try {
      if (parsedOptions.length === 0) {
        // Backward compatible: no options, return simple price
        const unitPrice = calculatePrice(width, height, productMatrix.matrixData);
        const total = unitPrice * quantity;

        const response = json(
          {
            price: unitPrice,
            currency: productMatrix.currency,
            dimensions: { width, height, unit: productMatrix.unit },
            quantity,
            total,
            matrix: productMatrix.matrixName,
            dimensionRange: productMatrix.dimensionRange,
          },
          { headers: getRateLimitHeaders(store.id) }
        );
        return withCors(response);
      } else {
        // With options: return price breakdown
        result = calculatePriceWithOptions(
          width,
          height,
          productMatrix.matrixData,
          parsedOptions,
          optionGroups
        );

        const total = result.totalPrice * quantity;

        const response = json(
          {
            basePrice: result.basePrice,
            optionModifiers: result.modifiers.map(m => ({
              optionGroup: m.optionGroupName,
              choice: m.choiceLabel,
              modifierType: m.modifierType,
              modifierValue: m.modifierValue,
              appliedAmount: m.appliedAmount,
            })),
            price: result.totalPrice,
            currency: productMatrix.currency,
            dimensions: { width, height, unit: productMatrix.unit },
            quantity,
            total,
            matrix: productMatrix.matrixName,
            dimensionRange: productMatrix.dimensionRange,
          },
          { headers: getRateLimitHeaders(store.id) }
        );
        return withCors(response);
      }
    } catch (error) {
      console.error("Price calculation error:", error);
      throw json(
        { type: "about:blank", title: "Internal Server Error", status: 500, detail: "Failed to calculate price" },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Response) return withCors(error);
    console.error("Unexpected API error:", error);
    return withCors(
      json(
        { type: "about:blank", title: "Internal Server Error", status: 500, detail: "An unexpected error occurred" },
        { status: 500 }
      )
    );
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| URL versioning (/api/v2/) | Optional parameters | 2020+ | Optional parameters reduce maintenance burden, allow single implementation for backward-compatible changes |
| Separate validation libraries | Zod with TypeScript | 2022+ | Zod provides schema + types from single source of truth, reducing duplication and type errors |
| Floating-point for money | Integer cents | Always best practice | Integers avoid precision errors, Modern Treasury published guidance in 2024 reinforcing integer approach |
| Custom retry logic | exponential-backoff library | 2020+ | Battle-tested library handles edge cases (jitter, max delays) better than custom implementations |
| Inline validation | Service layer validation | 2023+ | Separation of concerns: schema (Zod) validates structure, service layer validates business rules (database queries) |
| GraphQL for everything | REST + GraphQL hybrid | 2024+ | REST for simple CRUD, GraphQL for complex queries. Shopify apps use both based on use case |

**Deprecated/outdated:**
- **URL versioning for minor changes:** Industry moved toward optional parameters and deprecation notices instead of version proliferation. Save versioning for breaking changes.
- **Decimal libraries for simple cases:** While libraries like Dinero.js are powerful, integer cents arithmetic is simpler and sufficient for most e-commerce cases.
- **Custom retry implementations:** exponential-backoff and similar libraries are now standard, replacing custom loops.
- **Mixing validation concerns:** Putting database queries in schema validators (e.g., Zod refinements) is anti-pattern. Separate schema validation from business validation.

## Open Questions

1. **Should we support bulk price queries (multiple option combinations at once)?**
   - What we know: Current API calculates one price per request. Storefront widget might need to show multiple prices (different option combinations) simultaneously.
   - What's unclear: Performance impact, API design (POST with array of requests?), response format complexity.
   - Recommendation: Out of scope for Phase 13. Add if Phase 14 (widget) reveals performance issues with sequential requests. Single-price API is simpler and covers MVP requirements.

2. **How to version API if breaking changes are needed in future?**
   - What we know: Current API is `/api/v1/...`, URL includes version. Optional parameters maintain backward compatibility within v1.
   - What's unclear: What constitutes a breaking change requiring v2? How long to support v1?
   - Recommendation: Document breaking change policy: v1 supported for minimum 12 months after v2 release. Breaking changes include: removing fields, changing field types, removing backward-compatible defaults. Non-breaking: adding optional fields, adding response fields.

3. **Should we validate modifier sum limits (e.g., total discount can't exceed 100%)?**
   - What we know: Phase 11 allows negative modifiers (discounts). No cap on total modifier amount.
   - What's unclear: Can combined modifiers result in negative total price? Should there be safeguards?
   - Recommendation: Phase 13: allow any total (even negative) for flexibility. Phase 14 or later: add optional validation rules in service layer if merchants report issues. Don't over-constrain prematurely.

4. **How to handle option group/choice deletions while Draft Orders exist?**
   - What we know: Draft Orders store option selections as custom attributes (key-value strings). If group/choice is deleted, custom attributes still show historical labels.
   - What's unclear: Do we need to prevent deletion of groups/choices used in open Draft Orders?
   - Recommendation: No prevention needed. Custom attributes are static strings, so historical Draft Orders remain readable. Deletion warnings (from Phase 12) already indicate product usage. Document that deletion doesn't affect existing Draft Orders.

5. **Should API return default choices in response even if not selected?**
   - What we know: calculatePriceWithOptions internally applies defaults. Modifiers array includes defaults.
   - What's unclear: Should response distinguish "explicitly selected" vs "default applied"?
   - Recommendation: Include a flag in optionModifiers: `"isDefault": true/false`. Helps clients show "Your selection" vs "Default" in UI. Minimal API change, better transparency.

## Sources

### Primary (HIGH confidence)

- [API Versioning Strategies: Backward Compatibility in REST APIs | Medium](https://medium.com/@fahimad/api-versioning-strategies-backward-compatibility-in-rest-apis-234bafd5388e)
- [API Versioning Best Practices for Backward Compatibility | Endgrate](https://endgrate.com/blog/api-versioning-best-practices-for-backward-compatibility)
- [How to Validate Data with Zod in TypeScript | OneUpTime](https://oneuptime.com/blog/post/2026-01-25-zod-validation-typescript/view)
- [REST API Validation Using Zod | Jeff Segovia](https://jeffsegovia.dev/blogs/rest-api-validation-using-zod)
- [Zod documentation](https://zod.dev/)
- [DraftOrderLineItem - GraphQL Admin | Shopify](https://shopify.dev/docs/api/admin-graphql/latest/objects/DraftOrderLineItem)
- [Floats Don't Work For Storing Cents | Modern Treasury](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents)
- [Precision Matters: Using Cents Instead of Floating Point | HackerOne](https://www.hackerone.com/blog/precision-matters-why-using-cents-instead-floating-point-transaction-amounts-crucial)
- Existing codebase: `app/routes/api.v1.products.$productId.price.ts`, `app/routes/api.v1.draft-orders.ts`, `app/services/price-calculator.server.ts`, `app/services/option-group.server.ts`, `app/validators/api.validators.ts`

### Secondary (MEDIUM confidence)

- [Mastering Zod Validation | Codeminer42](https://blog.codeminer42.com/zod-validation-101/)
- [Zalando RESTful API Guidelines - Compatibility](https://github.com/zalando/restful-api-guidelines/blob/main/chapters/compatibility.adoc)
- [Atlassian REST API policy](https://developer.atlassian.com/platform/marketplace/atlassian-rest-api-policy/)
- [Floating-Point Numbers and Money | Medium](https://medium.com/@Tom1212121/floating-point-numbers-and-money-a433b326396f)
- Azure Retail Prices REST API pattern
- Phase 12 research document (established patterns)

### Tertiary (LOW confidence)

None - all key findings verified with official documentation, established libraries, or existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, versions verified from package.json
- Architecture: HIGH - Patterns verified from existing API routes, service layer, validators
- Pitfalls: HIGH - Based on industry best practices (integer cents, backward compatibility) and observable patterns

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - REST API best practices are stable, Zod and Prisma update regularly but breaking changes are rare)
