import { describe, expect, test } from "bun:test";
import {
  convertMinor,
  convertToBaseMinor,
  formatMoney,
  formatRate,
  ratePlausible,
} from "../../src/interface/web/currency-format.js";

describe("convertToBaseMinor", () => {
  test("converts a foreign major amount into base minor units (zero-decimal base)", () => {
    // 12.34 USD at rate 150 -> round(12.34 * 150) = 1851 JPY (minorUnits 0).
    expect(convertToBaseMinor(12.34, 150, 0)).toBe(1851);
  });

  test("rounds into a two-decimal base currency's minor units", () => {
    // 10 units at rate 1.2345 -> 12.345 major -> 1234.5 minor -> rounds to 1235.
    expect(convertToBaseMinor(10, 1.2345, 2)).toBe(1235);
  });

  test("returns null for empty, zero, negative, or non-finite inputs", () => {
    expect(convertToBaseMinor(NaN, 150, 0)).toBeNull();
    expect(convertToBaseMinor(10, NaN, 0)).toBeNull();
    expect(convertToBaseMinor(0, 150, 0)).toBeNull();
    expect(convertToBaseMinor(10, 0, 0)).toBeNull();
    expect(convertToBaseMinor(-5, 150, 0)).toBeNull();
    expect(convertToBaseMinor(10, -1, 0)).toBeNull();
    expect(convertToBaseMinor(Infinity, 150, 0)).toBeNull();
  });
});

describe("convertMinor (base -> display currency, for read-only totals)", () => {
  test("converts a base minor amount into a display currency's minor units", () => {
    // ¥1,851 (JPY, 0 decimals) at base->display rate 1/150 -> $12.34 (2 decimals).
    expect(convertMinor(1851, 0, 1 / 150, 2)).toBe(1234);
  });

  test("converts from a two-decimal base into a zero-decimal display", () => {
    // $12.34 (2 decimals) at rate 150 -> ¥1,851 (0 decimals).
    expect(convertMinor(1234, 2, 150, 0)).toBe(1851);
  });

  test("preserves sign for negative totals (e.g. a negative net)", () => {
    expect(convertMinor(-1851, 0, 1 / 150, 2)).toBe(-1234);
  });

  test("returns null for a non-finite amount or non-positive rate", () => {
    expect(convertMinor(NaN, 0, 150, 2)).toBeNull();
    expect(convertMinor(1000, 0, 0, 2)).toBeNull();
    expect(convertMinor(1000, 0, -1, 2)).toBeNull();
  });
});

describe("formatRate (compact rate for display, no spurious float digits)", () => {
  test("trims a long fractional rate to a sensible precision", () => {
    expect(formatRate(0.0066845678)).toBe("0.0066846");
  });

  test("leaves a whole-number rate clean", () => {
    expect(formatRate(150)).toBe("150");
  });

  test("keeps an ordinary few-decimal rate intact", () => {
    expect(formatRate(1.08)).toBe("1.08");
  });

  test("returns an empty string for a non-finite rate", () => {
    expect(formatRate(NaN)).toBe("");
  });
});

describe("formatMoney", () => {
  test("formats minor units with the currency symbol and precision (JPY)", () => {
    expect(formatMoney(1851, { minorUnits: 0, symbol: "¥" })).toBe("¥1,851");
  });

  test("formats a two-decimal currency", () => {
    expect(formatMoney(1235, { minorUnits: 2, symbol: "$" })).toBe("$12.35");
  });
});

describe("ratePlausible", () => {
  // We have no reference rate client-side, so the only honest, currency-agnostic
  // sanity check is whether the rate's order of magnitude is extreme. A rate
  // outside [1/1000, 1000] almost always means a typo (e.g. 15000 for 150);
  // legitimate FX rates (incl. JPY ~150) sit comfortably inside.
  test("flags an extreme rate (fat-fingered, e.g. 15000 instead of 150)", () => {
    expect(ratePlausible(15000)).toBe(false);
  });

  test("flags an extremely small rate", () => {
    expect(ratePlausible(0.0001)).toBe(false);
  });

  test("accepts ordinary FX rates including JPY-scale rates", () => {
    expect(ratePlausible(150)).toBe(true);
    expect(ratePlausible(1.08)).toBe(true);
    expect(ratePlausible(0.0067)).toBe(true);
  });
});
