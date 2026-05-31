import { describe, expect, test } from "bun:test";
import { InvalidValueError } from "../../src/domain/errors.ts";
import { GetExchangeRate } from "../../src/application/use-cases/get-exchange-rate.ts";
import { type ExchangeRateProvider } from "../../src/application/ports/exchange-rate-provider.ts";

function providerReturning(rate: number | null): ExchangeRateProvider {
  return {
    getLatestRate: async (from, to) =>
      rate === null ? null : { from, to, rate, asOf: "2026-05-29", source: "frankfurter" },
  };
}

describe("GetExchangeRate", () => {
  test("short-circuits to an identity rate without calling the provider", async () => {
    let called = false;
    const provider: ExchangeRateProvider = {
      getLatestRate: async () => {
        called = true;
        return null;
      },
    };
    const result = await new GetExchangeRate(provider).execute("JPY", "JPY");
    expect(result).toEqual({ from: "JPY", to: "JPY", rate: 1, asOf: null, source: "identity" });
    expect(called).toBe(false);
  });

  test("returns the provider's quote for a foreign pair", async () => {
    const result = await new GetExchangeRate(providerReturning(150.42)).execute("USD", "JPY");
    expect(result).toEqual({
      from: "USD",
      to: "JPY",
      rate: 150.42,
      asOf: "2026-05-29",
      source: "frankfurter",
    });
  });

  test("reports a null rate (manual fallback) when the provider has none", async () => {
    const result = await new GetExchangeRate(providerReturning(null)).execute("TWD", "JPY");
    expect(result).toEqual({ from: "TWD", to: "JPY", rate: null, asOf: null, source: null });
  });

  test("rejects an unsupported currency before calling the provider", async () => {
    await expect(new GetExchangeRate(providerReturning(150)).execute("XXX", "JPY")).rejects.toThrow(
      InvalidValueError,
    );
  });
});
