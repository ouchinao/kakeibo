import { describe, expect, test } from "bun:test";
import { CurrencyMismatchError, InvalidValueError } from "../../src/domain/errors.ts";
import { Money } from "../../src/domain/money.ts";

describe("Money", () => {
  describe("construction", () => {
    test("ofMinor keeps the exact integer amount", () => {
      const money = Money.ofMinor(1234, "USD");
      expect(money.amount).toBe(1234);
      expect(money.currency).toBe("USD");
    });

    test("ofMajor converts major units using the currency precision", () => {
      expect(Money.ofMajor(12.34, "USD").amount).toBe(1234);
      expect(Money.ofMajor(1200, "JPY").amount).toBe(1200); // JPY has 0 decimals
    });

    test("ofMajor rejects more precision than the currency allows", () => {
      expect(() => Money.ofMajor(12.345, "USD")).toThrow(InvalidValueError);
    });

    test("rejects non-integer minor amounts", () => {
      expect(() => Money.ofMinor(10.5, "USD")).toThrow(InvalidValueError);
    });

    test("rejects unsupported currencies", () => {
      expect(() => Money.ofMinor(100, "XYZ")).toThrow(InvalidValueError);
    });

    test("normalises currency code casing", () => {
      expect(Money.ofMinor(100, "usd").currency).toBe("USD");
    });
  });

  describe("arithmetic", () => {
    test("adds and subtracts amounts of the same currency", () => {
      const a = Money.ofMinor(500, "USD");
      const b = Money.ofMinor(200, "USD");
      expect(a.add(b).amount).toBe(700);
      expect(a.subtract(b).amount).toBe(300);
    });

    test("subtraction can produce a negative amount", () => {
      const result = Money.ofMinor(200, "USD").subtract(Money.ofMinor(500, "USD"));
      expect(result.amount).toBe(-300);
      expect(result.isNegative()).toBe(true);
    });

    test("multiplies by a factor and rounds to the nearest minor unit", () => {
      expect(Money.ofMinor(100, "USD").multiply(0.085).amount).toBe(9); // 8.5 -> 9
    });

    test("rejects combining different currencies", () => {
      const usd = Money.ofMinor(100, "USD");
      const jpy = Money.ofMinor(100, "JPY");
      expect(() => usd.add(jpy)).toThrow(CurrencyMismatchError);
      expect(() => usd.compareTo(jpy)).toThrow(CurrencyMismatchError);
    });
  });

  describe("predicates and comparison", () => {
    test("classifies sign", () => {
      expect(Money.ofMinor(0, "USD").isZero()).toBe(true);
      expect(Money.ofMinor(1, "USD").isPositive()).toBe(true);
      expect(Money.ofMinor(-1, "USD").isNegative()).toBe(true);
    });

    test("compareTo orders amounts", () => {
      const small = Money.ofMinor(100, "USD");
      const big = Money.ofMinor(300, "USD");
      expect(small.compareTo(big)).toBeLessThan(0);
      expect(big.compareTo(small)).toBeGreaterThan(0);
      expect(small.compareTo(Money.ofMinor(100, "USD"))).toBe(0);
    });

    test("equals is value based", () => {
      expect(Money.ofMinor(100, "USD").equals(Money.ofMinor(100, "USD"))).toBe(true);
      expect(Money.ofMinor(100, "USD").equals(Money.ofMinor(101, "USD"))).toBe(false);
    });
  });

  describe("formatting", () => {
    test("formats JPY without decimals", () => {
      expect(Money.ofMinor(1200, "JPY").format()).toBe("¥1,200");
    });

    test("formats USD with two decimals", () => {
      expect(Money.ofMinor(1234, "USD").format()).toBe("$12.34");
    });

    test("toMajor returns the major-unit value", () => {
      expect(Money.ofMinor(1234, "USD").toMajor()).toBe(12.34);
      expect(Money.ofMinor(1200, "JPY").toMajor()).toBe(1200);
    });
  });

  test("is immutable (frozen)", () => {
    const money = Money.ofMinor(100, "USD");
    expect(Object.isFrozen(money)).toBe(true);
  });
});
