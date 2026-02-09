import { describe, it, expect } from "vitest";
import {
  calculateModifierAmount,
  calculatePriceWithOptions,
  type PriceModifier,
  type PriceBreakdownResult,
} from "./option-price-calculator.server";

describe("calculateModifierAmount", () => {
  describe("FIXED modifiers", () => {
    it("returns positive fixed value directly", () => {
      const modifier: PriceModifier = {
        type: "FIXED",
        value: 500,
        label: "Tempered glass",
      };
      expect(calculateModifierAmount(1000, modifier)).toBe(500);
    });

    it("returns negative fixed value directly", () => {
      const modifier: PriceModifier = {
        type: "FIXED",
        value: -500,
        label: "Economy discount",
      };
      expect(calculateModifierAmount(1000, modifier)).toBe(-500);
    });

    it("returns zero for zero fixed value", () => {
      const modifier: PriceModifier = {
        type: "FIXED",
        value: 0,
        label: "No change",
      };
      expect(calculateModifierAmount(1000, modifier)).toBe(0);
    });
  });

  describe("PERCENTAGE modifiers", () => {
    it("calculates 10% (1000 basis points) of $10.00", () => {
      const modifier: PriceModifier = {
        type: "PERCENTAGE",
        value: 1000,
        label: "Coating",
      };
      expect(calculateModifierAmount(1000, modifier)).toBe(100);
    });

    it("calculates 15% (1500 basis points) of $10.00", () => {
      const modifier: PriceModifier = {
        type: "PERCENTAGE",
        value: 1500,
        label: "Premium coating",
      };
      expect(calculateModifierAmount(1000, modifier)).toBe(150);
    });

    it("calculates negative 15% (discount)", () => {
      const modifier: PriceModifier = {
        type: "PERCENTAGE",
        value: -1500,
        label: "Economy finish",
      };
      expect(calculateModifierAmount(1000, modifier)).toBe(-150);
    });

    it("rounds up with ceiling: 999 cents * 15% = 149.85 -> 150", () => {
      const modifier: PriceModifier = {
        type: "PERCENTAGE",
        value: 1500,
        label: "Premium",
      };
      expect(calculateModifierAmount(999, modifier)).toBe(150);
    });

    it("rounds toward positive infinity for negative percentages: -149.85 -> -149", () => {
      const modifier: PriceModifier = {
        type: "PERCENTAGE",
        value: -1500,
        label: "Economy",
      };
      // Math.ceil(-149.85) = -149 (rounds toward positive infinity)
      expect(calculateModifierAmount(999, modifier)).toBe(-149);
    });

    it("returns zero for zero percentage", () => {
      const modifier: PriceModifier = {
        type: "PERCENTAGE",
        value: 0,
        label: "No change",
      };
      expect(calculateModifierAmount(1000, modifier)).toBe(0);
    });

    it("handles edge case: 333 cents * 33.33% (3333 basis points)", () => {
      const modifier: PriceModifier = {
        type: "PERCENTAGE",
        value: 3333,
        label: "Special",
      };
      // 333 * 3333 / 10000 = 110.9889 -> Math.ceil = 111
      expect(calculateModifierAmount(333, modifier)).toBe(111);
    });

    it("handles tiny percentage: 1 cent * 0.01% (1 basis point) -> rounds up to 1", () => {
      const modifier: PriceModifier = {
        type: "PERCENTAGE",
        value: 1,
        label: "Tiny",
      };
      // 1 * 1 / 10000 = 0.0001 -> Math.ceil = 1
      expect(calculateModifierAmount(1, modifier)).toBe(1);
    });
  });
});

describe("calculatePriceWithOptions", () => {
  describe("no modifiers", () => {
    it("returns base price when no modifiers provided", () => {
      const result = calculatePriceWithOptions(1000, []);
      expect(result).toEqual({
        basePriceCents: 1000,
        modifiers: [],
        totalCents: 1000,
      });
    });
  });

  describe("single modifier", () => {
    it("adds single fixed modifier", () => {
      const modifiers: PriceModifier[] = [
        { type: "FIXED", value: 500, label: "Glass" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);
      expect(result.basePriceCents).toBe(1000);
      expect(result.totalCents).toBe(1500);
      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0]).toEqual({
        label: "Glass",
        type: "FIXED",
        originalValue: 500,
        appliedAmountCents: 500,
      });
    });

    it("adds single percentage modifier", () => {
      const modifiers: PriceModifier[] = [
        { type: "PERCENTAGE", value: 1000, label: "Coating" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);
      expect(result.basePriceCents).toBe(1000);
      expect(result.totalCents).toBe(1100);
      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0]).toEqual({
        label: "Coating",
        type: "PERCENTAGE",
        originalValue: 1000,
        appliedAmountCents: 100,
      });
    });
  });

  describe("multiple modifiers - non-compounding", () => {
    it("stacks multiple modifiers additively from base price", () => {
      const modifiers: PriceModifier[] = [
        { type: "FIXED", value: 500, label: "A" },
        { type: "PERCENTAGE", value: 1000, label: "B" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);
      expect(result.totalCents).toBe(1600); // 1000 + 500 + 100
      expect(result.modifiers).toHaveLength(2);
    });

    it("calculates all percentages from base price (non-compounding)", () => {
      const modifiers: PriceModifier[] = [
        { type: "PERCENTAGE", value: 1000, label: "A" },
        { type: "PERCENTAGE", value: 500, label: "B" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);
      // 1000 + (10% of 1000) + (5% of 1000) = 1000 + 100 + 50 = 1150
      // NOT 1000 * 1.1 * 1.05 = 1155 (would be compounding)
      expect(result.totalCents).toBe(1150);
    });
  });

  describe("negative modifiers (discounts)", () => {
    it("subtracts negative fixed modifier", () => {
      const modifiers: PriceModifier[] = [
        { type: "FIXED", value: -300, label: "Discount" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);
      expect(result.totalCents).toBe(700);
      expect(result.modifiers[0].appliedAmountCents).toBe(-300);
    });

    it("subtracts negative percentage modifier", () => {
      const modifiers: PriceModifier[] = [
        { type: "PERCENTAGE", value: -1500, label: "Economy" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);
      expect(result.totalCents).toBe(850); // 1000 - 150
      expect(result.modifiers[0].appliedAmountCents).toBe(-150);
    });
  });

  describe("floor at zero (never negative)", () => {
    it("floors total at zero when fixed discount exceeds base price", () => {
      const modifiers: PriceModifier[] = [
        { type: "FIXED", value: -1500, label: "Big discount" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);
      expect(result.totalCents).toBe(0); // Not -500
    });

    it("floors at zero when percentage is -100%", () => {
      const modifiers: PriceModifier[] = [
        { type: "PERCENTAGE", value: -10000, label: "100% off" },
      ];
      const result = calculatePriceWithOptions(500, modifiers);
      expect(result.totalCents).toBe(0);
    });

    it("floors at zero when multiple discounts exceed base price", () => {
      const modifiers: PriceModifier[] = [
        { type: "FIXED", value: -700, label: "Discount A" },
        { type: "PERCENTAGE", value: -5000, label: "Discount B" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);
      // 1000 - 700 - 500 = -200 -> floored to 0
      expect(result.totalCents).toBe(0);
    });
  });

  describe("zero base price", () => {
    it("handles zero base price with fixed modifier", () => {
      const modifiers: PriceModifier[] = [
        { type: "FIXED", value: 500, label: "A" },
      ];
      const result = calculatePriceWithOptions(0, modifiers);
      expect(result.totalCents).toBe(500);
    });

    it("handles zero base price with percentage modifier", () => {
      const modifiers: PriceModifier[] = [
        { type: "PERCENTAGE", value: 1000, label: "A" },
      ];
      const result = calculatePriceWithOptions(0, modifiers);
      expect(result.totalCents).toBe(0); // 10% of 0 = 0
    });
  });

  describe("all zero modifiers", () => {
    it("returns base price when all modifiers are zero", () => {
      const modifiers: PriceModifier[] = [
        { type: "FIXED", value: 0, label: "A" },
        { type: "PERCENTAGE", value: 0, label: "B" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);
      expect(result.totalCents).toBe(1000);
      expect(result.modifiers).toHaveLength(2);
      expect(result.modifiers[0].appliedAmountCents).toBe(0);
      expect(result.modifiers[1].appliedAmountCents).toBe(0);
    });
  });

  describe("breakdown structure", () => {
    it("includes correct breakdown for each modifier", () => {
      const modifiers: PriceModifier[] = [
        { type: "FIXED", value: 500, label: "Tempered glass" },
        { type: "PERCENTAGE", value: 1500, label: "Premium coating" },
        { type: "FIXED", value: -200, label: "Bulk discount" },
      ];
      const result = calculatePriceWithOptions(1000, modifiers);

      expect(result.modifiers).toEqual([
        {
          label: "Tempered glass",
          type: "FIXED",
          originalValue: 500,
          appliedAmountCents: 500,
        },
        {
          label: "Premium coating",
          type: "PERCENTAGE",
          originalValue: 1500,
          appliedAmountCents: 150,
        },
        {
          label: "Bulk discount",
          type: "FIXED",
          originalValue: -200,
          appliedAmountCents: -200,
        },
      ]);
      // 1000 + 500 + 150 - 200 = 1450
      expect(result.totalCents).toBe(1450);
    });
  });
});
