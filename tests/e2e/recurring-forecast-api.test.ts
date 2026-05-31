import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type App, createApp } from "../../src/composition.ts";

let app: App;

beforeEach(() => {
  app = createApp({ databasePath: ":memory:", defaultCurrency: "JPY" });
});

afterEach(() => {
  app.close();
});

function send(method: string, path: string, body?: unknown): Promise<Response> {
  return app.fetch(
    new Request(`http://test.local${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const readJson = (res: Response): Promise<any> => res.json() as Promise<any>;

async function addRent(): Promise<string> {
  const res = await send("POST", "/api/recurring", {
    name: "Rent",
    amount: 85000,
    category: "NEEDS",
    dayOfMonth: 1,
  });
  expect(res.status).toBe(201);
  return (await readJson(res)).id;
}

describe("Recurring & Forecast API", () => {
  test("creates, lists, and deletes a recurring expense", async () => {
    const id = await addRent();

    const list = await readJson(await send("GET", "/api/recurring"));
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Rent");

    const del = await send("DELETE", `/api/recurring/${id}`);
    expect(del.status).toBe(204);
    expect(await readJson(await send("GET", "/api/recurring"))).toHaveLength(0);
  });

  test("validates recurring expense input", async () => {
    const res = await send("POST", "/api/recurring", {
      name: "Bad",
      amount: 1000,
      category: "NEEDS",
      dayOfMonth: 31, // out of the allowed 1-28 range
    });
    expect(res.status).toBe(400);
  });

  test("posts recurring expenses into a month, idempotently", async () => {
    await addRent();

    const first = await readJson(await send("POST", "/api/recurring/post?month=2026-05"));
    expect(first.posted).toBe(1);

    const second = await readJson(await send("POST", "/api/recurring/post?month=2026-05"));
    expect(second.posted).toBe(0);

    const txs = await readJson(await send("GET", "/api/transactions?month=2026-05"));
    expect(txs).toHaveLength(1);
    expect(txs[0].note).toBe("Rent");
  });

  test("forecast projects recurring and reacts to posting", async () => {
    await send("PUT", "/api/plans/2026-05", { plannedIncome: 300000, savingsGoal: 50000 });
    await addRent();

    const before = await readJson(await send("GET", "/api/forecast?month=2026-05"));
    expect(before.recurringRemaining.minor).toBe(85000);
    expect(before.projectedNet.minor).toBe(215000);
    expect(before.onTrack).toBe(true);

    await send("POST", "/api/recurring/post?month=2026-05");

    const after = await readJson(await send("GET", "/api/forecast?month=2026-05"));
    expect(after.recurringRemaining.minor).toBe(0);
    expect(after.actualExpense.minor).toBe(85000);
    expect(after.projectedNet.minor).toBe(215000); // stable across posting
  });

  test("rejects a foreign-currency recurring expense without a rate", async () => {
    const res = await send("POST", "/api/recurring", {
      name: "Netflix",
      amount: 15,
      currency: "USD",
      category: "WANTS",
      dayOfMonth: 1,
    });
    expect(res.status).toBe(400);
  });

  test("projects a foreign recurring expense into the base-currency forecast", async () => {
    const created = await send("POST", "/api/recurring", {
      name: "Netflix",
      amount: 15,
      currency: "USD",
      category: "WANTS",
      dayOfMonth: 1,
      rate: 150, // USD -> JPY (base)
    });
    expect(created.status).toBe(201);
    expect((await readJson(created)).baseAmount.formatted).toBe("¥2,250");

    const forecast = await readJson(await send("GET", "/api/forecast?month=2026-05"));
    expect(forecast.currency).toBe("JPY");
    expect(forecast.recurringRemaining.minor).toBe(2250);
  });

  test("forecast requires a month parameter", async () => {
    expect((await send("GET", "/api/forecast")).status).toBe(400);
  });
});
