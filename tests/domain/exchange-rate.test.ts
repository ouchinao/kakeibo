import { describe, expect, test } from "bun:test";
import { CurrencyMismatchError, InvalidValueError } from "../../src/domain/errors.ts";
import { ExchangeRate } from "../../src/domain/exchange-rate.ts";
import { Money } from "../../src/domain/money.ts";

describe("ExchangeRate", () => {
  describe("construction", () => {
    test("normalises currency codes and keeps the rate", () => {
      const rate = ExchangeRate.of("usd", "jpy", 150);
      expect(rate.from).toBe("USD");
      expect(rate.to).toBe("JPY");
      expect(rate.rate).toBe(150);
    });

    test("rejects an unsupported currency", () => {
      expect(() => ExchangeRate.of("USD", "XYZ", 1)).toThrow(InvalidValueError);
    });

    test.each([
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])("rejects a non-positive/!finite rate: %p", (bad) => {
      expect(() => ExchangeRate.of("USD", "JPY", bad)).toThrow(InvalidValueError);
    });

    test("identity is a rate of 1 within one currency", () => {
      const id = ExchangeRate.identity("USD");
      expect(id.from).toBe("USD");
      expect(id.to).toBe("USD");
      expect(id.rate).toBe(1);
    });
  });

  describe("convert", () => {
    test("converts USD to JPY, rounding to the target's precision (0 decimals)", () => {
      const rate = ExchangeRate.of("USD", "JPY", 110.5);
      const result = rate.convert(Money.ofMinor(1234, "USD")); // $12.34
      // 12.34 * 110.5 = 1363.57 -> JPY rounds to 1364
      expect(result.currency).toBe("JPY");
      expect(result.amount).toBe(1364);
    });

    test("converts JPY to USD, rounding to 2 decimals", () => {
      const rate = ExchangeRate.of("JPY", "USD", 0.009);
      const result = rate.convert(Money.ofMinor(1000, "JPY")); // ¥1000
      // 1000 * 0.009 = 9.00 -> $9.00
      expect(result.currency).toBe("USD");
      expect(result.amount).toBe(900);
    });

    test("an identity rate returns an equal amount", () => {
      const id = ExchangeRate.identity("JPY");
      const money = Money.ofMinor(1500, "JPY");
      expect(id.convert(money).equals(money)).toBe(true);
    });

    test("rejects converting money whose currency is not the rate's source", () => {
      const rate = ExchangeRate.of("USD", "JPY", 110);
      expect(() => rate.convert(Money.ofMinor(1000, "EUR"))).toThrow(CurrencyMismatchError);
    });

    test("rounds to the nearest minor unit of the target", () => {
      const eurToUsd = ExchangeRate.of("EUR", "USD", 1.018);
      // €1.00 * 1.018 = 1.018 USD -> rounds to 1.02 -> 102 minor
      expect(eurToUsd.convert(Money.ofMinor(100, "EUR")).amount).toBe(102);

      const eurToJpy = ExchangeRate.of("EUR", "JPY", 162.4);
      // €12.34 * 162.4 = 2004.016 -> JPY rounds to 2004
      expect(eurToJpy.convert(Money.ofMinor(1234, "EUR")).amount).toBe(2004);
    });
  });
});
