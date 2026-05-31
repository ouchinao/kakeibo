import { describe, expect, test } from "bun:test";
import { getCurrency, listCurrencies } from "../../src/domain/currency.ts";

describe("listCurrencies", () => {
  test("returns the supported currencies with their precision", () => {
    const byCode = Object.fromEntries(listCurrencies().map((c) => [c.code, c]));
    expect(Object.keys(byCode).sort()).toEqual(["EUR", "JPY", "USD"]);
    expect(byCode.JPY?.minorUnits).toBe(0);
    expect(byCode.USD?.minorUnits).toBe(2);
    expect(byCode.EUR?.minorUnits).toBe(2);
  });

  test("each listed currency resolves via getCurrency", () => {
    for (const c of listCurrencies()) {
      expect(getCurrency(c.code).code).toBe(c.code);
    }
  });
});
