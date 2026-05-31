import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type App, createApp } from "../../src/composition.ts";

let app: App;

beforeEach(() => {
  app = createApp({ databasePath: ":memory:", defaultCurrency: "JPY" });
});

afterEach(() => {
  app.close();
});

/** Helper to issue a JSON request against the in-process app. */
async function request(method: string, path: string, body?: unknown): Promise<Response> {
  return app.fetch(
    new Request(`http://test.local${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Parses a response body as loosely-typed JSON for assertions. */
function readJson(res: Response): Promise<any> {
  return res.json() as Promise<any>;
}

describe("HTTP API", () => {
  test("health check responds ok", async () => {
    const res = await request("GET", "/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("records, lists, and deletes a transaction end to end", async () => {
    const created = await request("POST", "/api/transactions", {
      type: "EXPENSE",
      amount: 1500,
      category: "NEEDS",
      note: "Groceries",
      occurredAt: "2026-05-10T08:00:00Z",
    });
    expect(created.status).toBe(201);
    const tx = await readJson(created);
    expect(tx.amount.formatted).toBe("¥1,500");

    const list = await readJson(await request("GET", "/api/transactions?month=2026-05"));
    expect(list).toHaveLength(1);

    const del = await request("DELETE", `/api/transactions/${tx.id}`);
    expect(del.status).toBe(204);

    const empty = await readJson(await request("GET", "/api/transactions?month=2026-05"));
    expect(empty).toHaveLength(0);
  });

  test("rejects an invalid transaction with 400 and details", async () => {
    const res = await request("POST", "/api/transactions", {
      type: "EXPENSE",
      amount: 1000,
      // missing category
    });
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("deleting a missing transaction returns 404", async () => {
    const res = await request("DELETE", "/api/transactions/nope");
    expect(res.status).toBe(404);
    expect((await readJson(res)).error.code).toBe("NOT_FOUND");
  });

  test("creates a plan and reflects it in the summary", async () => {
    await request("PUT", "/api/plans/2026-05", {
      plannedIncome: 300000,
      savingsGoal: 60000,
      categoryBudgets: { NEEDS: 150000, WANTS: 50000 },
    });
    await request("POST", "/api/transactions", {
      type: "INCOME",
      amount: 300000,
      occurredAt: "2026-05-01T00:00:00Z",
    });
    await request("POST", "/api/transactions", {
      type: "EXPENSE",
      amount: 70000,
      category: "WANTS",
      occurredAt: "2026-05-12T00:00:00Z",
    });

    const summary = await readJson(await request("GET", "/api/summary?month=2026-05"));
    expect(summary.availableToSpend.minor).toBe(240000);
    expect(summary.remainingToSpend.minor).toBe(170000);
    expect(summary.actualSavings.minor).toBe(230000);
    expect(summary.savingsGoalMet).toBe(true);

    const wants = summary.categories.find((c: any) => c.category === "WANTS");
    expect(wants.overBudget).toBe(true);
  });

  test("plan upsert preserves data and round-trips through GET", async () => {
    await request("PUT", "/api/plans/2026-05", { plannedIncome: 300000, savingsGoal: 60000 });
    await request("PUT", "/api/plans/2026-05", { plannedIncome: 320000, savingsGoal: 90000 });

    const plan = await readJson(await request("GET", "/api/plans/2026-05"));
    expect(plan.plannedIncome.minor).toBe(320000);
    expect(plan.savingsGoal.minor).toBe(90000);
    expect(plan.availableToSpend.minor).toBe(230000);
  });

  test("returns 404 for a plan that does not exist", async () => {
    const res = await request("GET", "/api/plans/2030-01");
    expect(res.status).toBe(404);
  });

  test("saves and retrieves a reflection", async () => {
    await request("PUT", "/api/reflections/2026-05", {
      answers: { howToImprove: "Cook at home more", howMuchSaved: "¥230,000" },
    });
    const reflection = await readJson(await request("GET", "/api/reflections/2026-05"));
    expect(reflection.answers.howToImprove).toBe("Cook at home more");
    expect(reflection.questions.howToImprove).toContain("improve");
  });

  test("rejects a plan whose savings goal exceeds income (domain rule) with 400", async () => {
    const res = await request("PUT", "/api/plans/2026-05", {
      plannedIncome: 100000,
      savingsGoal: 200000,
    });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error.code).toBe("BusinessRuleError");
  });

  test("rejects a foreign-currency plan without a rate", async () => {
    const res = await request("PUT", "/api/plans/2026-05", {
      currency: "USD",
      plannedIncome: 2000,
      savingsGoal: 500,
    });
    expect(res.status).toBe(400);
  });

  test("applies a foreign-currency plan to the base-currency summary", async () => {
    await request("PUT", "/api/plans/2026-05", {
      currency: "USD",
      plannedIncome: 2000,
      savingsGoal: 500,
      rate: 150, // USD -> JPY (base)
    });
    const summary = await readJson(await request("GET", "/api/summary?month=2026-05"));
    expect(summary.currency).toBe("JPY");
    expect(summary.availableToSpend.minor).toBe(225000); // (2000 - 500) * 150
    expect(summary.savingsGoal.minor).toBe(75000);
  });

  test("unknown routes yield 404", async () => {
    const res = await request("GET", "/api/unknown");
    expect(res.status).toBe(404);
  });
});
