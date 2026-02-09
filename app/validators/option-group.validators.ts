import { z } from "zod";

/**
 * Validates a single choice within an option group.
 *
 * ModifierValue semantics:
 * - FIXED: Value in cents (e.g., 500 = $5.00)
 * - PERCENTAGE: Value in basis points (e.g., 1000 = 10%)
 * - Negative values allowed for discounts
 */
export const OptionChoiceInputSchema = z.object({
  label: z
    .string()
    .min(1, "Label is required")
    .max(100, "Label must be 100 characters or fewer"),
  modifierType: z.enum(["FIXED", "PERCENTAGE"]),
  modifierValue: z
    .number()
    .int("Modifier value must be a whole number"),
  isDefault: z.boolean().default(false),
});

/**
 * Validates option group creation input.
 * Enforces single-default and required-group constraints.
 */
export const OptionGroupCreateSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must be 100 characters or fewer"),
    requirement: z.enum(["REQUIRED", "OPTIONAL"]).default("OPTIONAL"),
    choices: z
      .array(OptionChoiceInputSchema)
      .min(1, "At least one choice is required")
      .max(20, "Maximum 20 choices per group"),
  })
  .refine(
    (data) => {
      const defaultChoices = data.choices.filter((c) => c.isDefault);
      return defaultChoices.length <= 1;
    },
    {
      message: "At most one choice can be marked as default",
      path: ["choices"],
    }
  )
  .refine(
    (data) => {
      // If requirement is REQUIRED, no choice should have isDefault: true
      if (data.requirement === "REQUIRED") {
        const hasDefault = data.choices.some((c) => c.isDefault);
        return !hasDefault;
      }
      return true;
    },
    {
      message: "Default choice cannot be set on required groups (they must always be selected)",
      path: ["choices"],
    }
  );

/**
 * Validates option group update input.
 * Same constraints as create, but all fields optional.
 */
export const OptionGroupUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must be 100 characters or fewer")
      .optional(),
    requirement: z.enum(["REQUIRED", "OPTIONAL"]).optional(),
    choices: z
      .array(
        OptionChoiceInputSchema.extend({
          id: z.string().optional(),
        })
      )
      .min(1, "At least one choice is required")
      .max(20, "Maximum 20 choices per group")
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.choices) return true;
      const defaultChoices = data.choices.filter((c) => c.isDefault);
      return defaultChoices.length <= 1;
    },
    {
      message: "At most one choice can be marked as default",
      path: ["choices"],
    }
  )
  .refine(
    (data) => {
      // If requirement is REQUIRED, no choice should have isDefault: true
      if (data.requirement === "REQUIRED" && data.choices) {
        const hasDefault = data.choices.some((c) => c.isDefault);
        return !hasDefault;
      }
      return true;
    },
    {
      message: "Default choice cannot be set on required groups",
      path: ["choices"],
    }
  );

/**
 * Validates assigning an option group to a product.
 */
export const ProductOptionGroupAssignSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  optionGroupId: z.string().min(1, "Option group ID is required"),
});

// Export inferred TypeScript types
export type OptionGroupCreateInput = z.infer<typeof OptionGroupCreateSchema>;
export type OptionGroupUpdateInput = z.infer<typeof OptionGroupUpdateSchema>;
export type OptionChoiceInput = z.infer<typeof OptionChoiceInputSchema>;
export type ProductOptionGroupAssignInput = z.infer<typeof ProductOptionGroupAssignSchema>;
