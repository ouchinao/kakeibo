import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type App, createApp } from "../../src/composition.ts";
import { type ExchangeRateProvider } from "../../src/application/ports/exchange-rate-provider.ts";

let app: App;

/** A deterministic provider so the API never touches the network in tests. */
const stubProvider: ExchangeRateProvider = {
  getLatestRate: async (from, to) =>
    from === "USD" ? { from, to, rate: 150, asOf: "2026-05-29", source: "frankfurter" } : null,
};

beforeEach(() => {
  app = createApp({ databasePath: ":memory:", defaultCurrency: "JPY", rateProvider: stubProvider });
});

afterEach(() => {
  app.close();
});

const get = (path: string): Promise<Response> =>
  app.fetch(new Request(`http://test.local${path}`));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readJson = (res: Response): Promise<any> => res.json() as Promise<any>;

describe("Exchange-rate API", () => {
  test("GET /api/rate returns the auto-fetched rate to the base currency", async () => {
    const res = await get("/api/rate?from=USD");
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body).toMatchObject({ from: "USD", to: "JPY", rate: 150, source: "frankfurter" });
  });

  test("GET /api/rate?from=JPY is an identity rate", async () => {
    const body = await readJson(await get("/api/rate?from=JPY"));
    expect(body).toMatchObject({ from: "JPY", to: "JPY", rate: 1, source: "identity" });
  });

  test("GET /api/rate reports a null rate when none is available (manual fallback)", async () => {
    const body = await readJson(await get("/api/rate?from=TWD"));
    expect(body).toMatchObject({ from: "TWD", to: "JPY", rate: null, source: null });
  });

  test("GET /api/rate without 'from' is a 400", async () => {
    expect((await get("/api/rate")).status).toBe(400);
  });

  test("GET /api/rate with an unsupported currency is a 400", async () => {
    expect((await get("/api/rate?from=XXX")).status).toBe(400);
  });
});
