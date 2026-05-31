import { describe, expect, test } from "bun:test";
import {
  convertToBaseMinor,
  formatMoney,
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
