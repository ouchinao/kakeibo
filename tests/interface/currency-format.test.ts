import { describe, expect, test } from "bun:test";
import { amountStep } from "../../src/interface/web/currency-format.js";

describe("amountStep", () => {
  test("integer step for zero-decimal currencies (JPY)", () => {
    expect(amountStep(0)).toBe("1");
  });

  test("two-decimal step for currencies with minor units (USD/EUR)", () => {
    expect(amountStep(2)).toBe("0.01");
  });

  test("generalises to other precisions", () => {
    expect(amountStep(3)).toBe("0.001");
  });
});
