import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type App, createApp } from "../../src/composition.ts";

let app: App;

beforeEach(() => {
  app = createApp({ databasePath: ":memory:", defaultCurrency: "JPY" });
});

afterEach(() => {
  app.close();
});

function get(path: string): Promise<Response> {
  return app.fetch(new Request(`http://test.local${path}`));
}

function post(path: string, body: unknown): Promise<Response> {
  return app.fetch(
    new Request(`http://test.local${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("Trend API", () => {
  test("defaults to a six-month window ending at the requested month", async () => {
    const points = (await (await get("/api/trend?month=2026-05")).json()) as Array<{
      month: string;
    }>;
    expect(points).toHaveLength(6);
    expect(points[0]?.month).toBe("2025-12");
    expect(points[5]?.month).toBe("2026-05");
  });

  test("reflects recorded transactions across months", async () => {
    await post("/api/transactions", {
      type: "EXPENSE",
      amount: 5000,
      category: "WANTS",
      occurredAt: "2026-04-10T00:00:00Z",
    });
    await post("/api/transactions", {
      type: "INCOME",
      amount: 200000,
      occurredAt: "2026-05-01T00:00:00Z",
    });

    const points = (await (await get("/api/trend?month=2026-05&months=3")).json()) as Array<{
      month: string;
      totalExpense: { minor: number };
      totalIncome: { minor: number };
    }>;
    expect(points).toHaveLength(3);
    expect(points.find((p) => p.month === "2026-04")?.totalExpense.minor).toBe(5000);
    expect(points.find((p) => p.month === "2026-05")?.totalIncome.minor).toBe(200000);
  });

  test("rejects an out-of-range month count with 400", async () => {
    expect((await get("/api/trend?month=2026-05&months=99")).status).toBe(400);
  });

  test("requires a month parameter", async () => {
    expect((await get("/api/trend")).status).toBe(400);
  });
});
