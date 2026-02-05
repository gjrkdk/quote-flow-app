/**
 * Price Calculator Service
 *
 * Provides price calculation logic for dimension-based pricing matrices.
 * Handles breakpoint lookup, rounding up between breakpoints, and clamping
 * for dimensions outside the defined breakpoint ranges.
 */

export interface MatrixData {
  widthBreakpoints: Array<{ position: number; value: number }>;
  heightBreakpoints: Array<{ position: number; value: number }>;
  cells: Array<{ widthPosition: number; heightPosition: number; price: number }>;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates customer dimensions and quantity.
 *
 * @param width - Width dimension (must be positive)
 * @param height - Height dimension (must be positive)
 * @param quantity - Quantity (must be positive integer)
 * @returns Validation result with error message if invalid
 */
export function validateDimensions(
  width: number,
  height: number,
  quantity: number
): ValidationResult {
  if (width <= 0 || height <= 0) {
    return {
      valid: false,
      error: "Width and height must be positive numbers",
    };
  }

  if (quantity <= 0 || !Number.isInteger(quantity)) {
    return {
      valid: false,
      error: "Quantity must be a positive integer",
    };
  }

  return { valid: true };
}

/**
 * Finds the breakpoint position for a given dimension value.
 *
 * Behavior:
 * - Exact match: returns that breakpoint's position
 * - Between breakpoints: rounds UP to next higher breakpoint position
 * - Below smallest: clamps to position 0
 * - Above largest: clamps to last position
 *
 * @param dimension - The dimension value to look up
 * @param breakpoints - Sorted array of breakpoints
 * @returns The position to use for price lookup
 */
function findBreakpointPosition(
  dimension: number,
  breakpoints: Array<{ position: number; value: number }>
): number {
  // Sort breakpoints by position to ensure correct ordering
  const sorted = [...breakpoints].sort((a, b) => a.position - b.position);

  // Find first breakpoint where dimension <= breakpoint.value
  // This naturally handles "round up" behavior
  const index = sorted.findIndex((bp) => dimension <= bp.value);

  // If index is -1, dimension is above all breakpoints -> clamp to last position
  // Otherwise use the found breakpoint's position
  return index === -1 ? sorted[sorted.length - 1].position : sorted[index].position;
}

/**
 * Calculates price for given dimensions using matrix breakpoints.
 *
 * Behavior:
 * - Exact breakpoint match: uses that breakpoint's position
 * - Between breakpoints: rounds UP to next higher breakpoint
 * - Below smallest breakpoint: clamps to position 0
 * - Above largest breakpoint: clamps to last position
 *
 * @param width - Customer width dimension
 * @param height - Customer height dimension
 * @param matrixData - Matrix with breakpoints and price cells
 * @returns Unit price for the dimensions
 * @throws Error if no price cell exists for calculated position
 */
export function calculatePrice(
  width: number,
  height: number,
  matrixData: MatrixData
): number {
  const widthPosition = findBreakpointPosition(width, matrixData.widthBreakpoints);
  const heightPosition = findBreakpointPosition(height, matrixData.heightBreakpoints);

  // Look up price cell for calculated position
  const cell = matrixData.cells.find(
    (c) => c.widthPosition === widthPosition && c.heightPosition === heightPosition
  );

  if (!cell) {
    throw new Error(
      `No price found for position (${widthPosition}, ${heightPosition})`
    );
  }

  return cell.price;
}
