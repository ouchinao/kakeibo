import { describe, expect, test } from "bun:test";
import { FrankfurterRateProvider } from "../../src/infrastructure/exchange-rate/frankfurter-rate-provider.ts";

/** Builds a fake `fetch` that returns the given JSON body with a status. */
function fakeFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("FrankfurterRateProvider", () => {
  test("parses the latest rate from the Frankfurter response", async () => {
    const provider = new FrankfurterRateProvider(
      fakeFetch({ amount: 1, base: "USD", date: "2026-05-29", rates: { JPY: 150.42 } }),
    );
    const quote = await provider.getLatestRate("USD", "JPY");
    expect(quote).toEqual({ from: "USD", to: "JPY", rate: 150.42, asOf: "2026-05-29", source: "frankfurter" });
  });

  test("requests the right currencies", async () => {
    let seenUrl = "";
    const spy = (async (input: string | URL | Request) => {
      seenUrl = String(input);
      return new Response(JSON.stringify({ date: "2026-05-29", rates: { JPY: 150 } }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new FrankfurterRateProvider(spy, "https://example.test/v1");
    await provider.getLatestRate("USD", "JPY");
    expect(seenUrl).toContain("base=USD");
    expect(seenUrl).toContain("symbols=JPY");
  });

  test("returns null on a non-OK response (e.g. unsupported currency)", async () => {
    const provider = new FrankfurterRateProvider(fakeFetch({ message: "not found" }, 404));
    expect(await provider.getLatestRate("TWD", "JPY")).toBeNull();
  });

  test("returns null when the target rate is missing or invalid", async () => {
    const provider = new FrankfurterRateProvider(fakeFetch({ date: "2026-05-29", rates: {} }));
    expect(await provider.getLatestRate("USD", "JPY")).toBeNull();
  });

  test("returns null when the network call throws (offline / blocked)", async () => {
    const throwing = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const provider = new FrankfurterRateProvider(throwing);
    expect(await provider.getLatestRate("USD", "JPY")).toBeNull();
  });
});
