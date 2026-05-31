import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type App, createApp } from "../../src/composition.ts";

let app: App;

beforeEach(() => {
  app = createApp({ databasePath: ":memory:", defaultCurrency: "JPY" });
});

afterEach(() => {
  app.close();
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function request(method: string, path: string, body?: unknown): Promise<Response> {
  return app.fetch(
    new Request(`http://test.local${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
const readJson = (res: Response): Promise<any> => res.json() as Promise<any>;

describe("Currency API", () => {
  test("GET /api/currencies lists the supported currencies with precision", async () => {
    const res = await request("GET", "/api/currencies");
    expect(res.status).toBe(200);
    const list = await readJson(res);
    const byCode = Object.fromEntries(list.map((c: any) => [c.code, c]));
    expect(Object.keys(byCode).sort()).toEqual([
      "AUD",
      "EUR",
      "JPY",
      "MYR",
      "SGD",
      "THB",
      "TWD",
      "USD",
    ]);
    expect(byCode.JPY.minorUnits).toBe(0);
    expect(byCode.USD.minorUnits).toBe(2);
    expect(byCode.SGD.minorUnits).toBe(2);
  });

  test("accepts decimals for a USD transaction", async () => {
    const res = await request("POST", "/api/transactions", {
      type: "EXPENSE",
      amount: 12.34,
      currency: "USD",
      category: "WANTS",
      occurredAt: "2026-05-10T00:00:00Z",
    });
    expect(res.status).toBe(201);
    expect((await readJson(res)).amount.formatted).toBe("$12.34");
  });

  test("rejects a non-integer JPY amount (JPY has no minor unit)", async () => {
    const res = await request("POST", "/api/transactions", {
      type: "EXPENSE",
      amount: 1500.5,
      currency: "JPY",
      category: "NEEDS",
      occurredAt: "2026-05-10T00:00:00Z",
    });
    expect(res.status).toBe(400);
  });

  test("summary reflects the requested currency override", async () => {
    await request("POST", "/api/transactions", {
      type: "EXPENSE",
      amount: 12.34,
      currency: "USD",
      category: "WANTS",
      occurredAt: "2026-05-10T00:00:00Z",
    });
    const summary = await readJson(await request("GET", "/api/summary?month=2026-05&currency=USD"));
    expect(summary.currency).toBe("USD");
    expect(summary.totalExpense.minor).toBe(1234);
  });
});
