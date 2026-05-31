import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type App, createApp } from "../../src/composition.ts";

let app: App;

beforeEach(() => {
  app = createApp({ databasePath: ":memory:", defaultCurrency: "JPY" });
});

afterEach(() => {
  app.close();
});

function jsonRequest(method: string, path: string, body?: unknown): Promise<Response> {
  return app.fetch(
    new Request(`http://test.local${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

function csvRequest(path: string, csv: string): Promise<Response> {
  return app.fetch(
    new Request(`http://test.local${path}`, {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: csv,
    }),
  );
}

describe("CSV import/export API", () => {
  test("exports recorded transactions as a CSV attachment", async () => {
    await jsonRequest("POST", "/api/transactions", {
      type: "EXPENSE",
      amount: 1500,
      category: "NEEDS",
      note: "Groceries",
      occurredAt: "2026-05-10T00:00:00Z",
    });

    const res = await app.fetch(
      new Request("http://test.local/api/transactions/export?month=2026-05"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("kakeibo-2026-05.csv");

    const text = await res.text();
    expect(text.split("\r\n")[0]).toBe("date,type,category,amount,currency,note");
    expect(text).toContain("EXPENSE,NEEDS,1500,JPY,Groceries");
  });

  test("imports transactions from CSV and they appear in the listing", async () => {
    const csv = [
      "date,type,category,amount,currency,note",
      "2026-05-01,INCOME,,300000,JPY,Salary",
      "2026-05-10,EXPENSE,NEEDS,1500,JPY,Groceries",
    ].join("\n");

    const res = await csvRequest("/api/transactions/import", csv);
    expect(res.status).toBe(201);
    expect(((await res.json()) as { imported: number }).imported).toBe(2);

    const list = await (
      await app.fetch(new Request("http://test.local/api/transactions?month=2026-05"))
    ).json();
    expect(list).toHaveLength(2);
  });

  test("export then re-import round-trips the data", async () => {
    await jsonRequest("POST", "/api/transactions", {
      type: "EXPENSE",
      amount: 12.34,
      currency: "USD",
      category: "WANTS",
      note: "Coffee, large",
      occurredAt: "2026-05-05T00:00:00Z",
      rate: 150, // foreign currency requires a rate to the base currency
    });
    const csv = await (
      await app.fetch(new Request("http://test.local/api/transactions/export?month=2026-05"))
    ).text();

    const fresh = createApp({ databasePath: ":memory:", defaultCurrency: "JPY" });
    try {
      const importRes = await fresh.fetch(
        new Request("http://test.local/api/transactions/import", {
          method: "POST",
          headers: { "content-type": "text/csv" },
          body: csv,
        }),
      );
      expect(importRes.status).toBe(201);
      const list = (await (
        await fresh.fetch(new Request("http://test.local/api/transactions?month=2026-05"))
      ).json()) as Array<{ amount: { formatted: string }; note: string }>;
      expect(list[0]?.amount.formatted).toBe("$12.34");
      expect(list[0]?.note).toBe("Coffee, large");
    } finally {
      fresh.close();
    }
  });

  test("rejects a malformed CSV with 400", async () => {
    const res = await csvRequest("/api/transactions/import", "type,category\nEXPENSE,NEEDS");
    expect(res.status).toBe(400);
  });
});
