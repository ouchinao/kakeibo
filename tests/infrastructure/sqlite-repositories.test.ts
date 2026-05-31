import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { Money } from "../../src/domain/money.ts";
import { MonthlyPlan } from "../../src/domain/monthly-plan.ts";
import { Reflection } from "../../src/domain/reflection.ts";
import { Transaction, TransactionType } from "../../src/domain/transaction.ts";
import { YearMonth } from "../../src/domain/year-month.ts";
import { migrate } from "../../src/infrastructure/persistence/database.ts";
import { SqliteMonthlyPlanRepository } from "../../src/infrastructure/persistence/sqlite-monthly-plan-repository.ts";
import { SqliteReflectionRepository } from "../../src/infrastructure/persistence/sqlite-reflection-repository.ts";
import { SqliteTransactionRepository } from "../../src/infrastructure/persistence/sqlite-transaction-repository.ts";

let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  migrate(db);
});

afterEach(() => {
  db.close();
});

describe("SqliteTransactionRepository", () => {
  const month = YearMonth.parse("2026-05");

  test("round-trips an expense through SQLite", async () => {
    const repo = new SqliteTransactionRepository(db);
    const tx = new Transaction({
      id: "tx-1",
      type: TransactionType.EXPENSE,
      amount: Money.ofMinor(1500, "JPY"),
      category: KakeiboCategory.NEEDS,
      occurredAt: new Date("2026-05-10T08:30:00Z"),
      note: "Groceries",
    });
    await repo.save(tx);

    const loaded = await repo.findById("tx-1");
    expect(loaded?.amount.amount).toBe(1500);
    expect(loaded?.category).toBe(KakeiboCategory.NEEDS);
    expect(loaded?.note).toBe("Groceries");
    expect(loaded?.occurredAt.toISOString()).toBe("2026-05-10T08:30:00.000Z");
  });

  test("findByMonth filters by occurrence month", async () => {
    const repo = new SqliteTransactionRepository(db);
    await repo.save(income("in-1", new Date("2026-05-02T00:00:00Z")));
    await repo.save(income("in-2", new Date("2026-06-02T00:00:00Z")));

    const may = await repo.findByMonth(month);
    expect(may.map((t) => t.id)).toEqual(["in-1"]);
  });

  test("delete reports whether a row was removed", async () => {
    const repo = new SqliteTransactionRepository(db);
    await repo.save(income("in-1", new Date("2026-05-02T00:00:00Z")));
    expect(await repo.delete("in-1")).toBe(true);
    expect(await repo.delete("in-1")).toBe(false);
    expect(await repo.findById("in-1")).toBeNull();
  });

  test("round-trips a distinct base-currency amount", async () => {
    const repo = new SqliteTransactionRepository(db);
    await repo.save(
      new Transaction({
        id: "fx-1",
        type: TransactionType.EXPENSE,
        amount: Money.ofMinor(1234, "USD"),
        baseAmount: Money.ofMinor(1850, "JPY"),
        category: KakeiboCategory.WANTS,
        occurredAt: new Date("2026-05-10T00:00:00Z"),
        note: "",
      }),
    );
    const loaded = await repo.findById("fx-1");
    expect(loaded?.amount.format()).toBe("$12.34");
    expect(loaded?.baseAmount.amount).toBe(1850);
    expect(loaded?.baseAmount.currency).toBe("JPY");
  });

  test("saveMany persists a whole batch", async () => {
    const repo = new SqliteTransactionRepository(db);
    await repo.saveMany([
      income("m-1", new Date("2026-05-01T00:00:00Z")),
      income("m-2", new Date("2026-05-02T00:00:00Z")),
    ]);
    expect(await repo.findByMonth(YearMonth.parse("2026-05"))).toHaveLength(2);
  });

  test("saveMany is atomic: a failing batch persists nothing", async () => {
    const repo = new SqliteTransactionRepository(db);
    const a = income("dup", new Date("2026-05-01T00:00:00Z"));
    const b = income("dup", new Date("2026-05-02T00:00:00Z")); // duplicate id

    await expect(repo.saveMany([a, b])).rejects.toThrow();
    // The transaction rolled back: not even the first row was committed.
    expect(await repo.findById("dup")).toBeNull();
  });

  function income(id: string, occurredAt: Date): Transaction {
    return new Transaction({
      id,
      type: TransactionType.INCOME,
      amount: Money.ofMinor(300000, "JPY"),
      occurredAt,
      note: "",
    });
  }
});

describe("SqliteMonthlyPlanRepository", () => {
  test("round-trips a plan with category budgets", async () => {
    const repo = new SqliteMonthlyPlanRepository(db);
    const plan = new MonthlyPlan({
      id: "plan-1",
      month: YearMonth.parse("2026-05"),
      plannedIncome: Money.ofMinor(300000, "JPY"),
      savingsGoal: Money.ofMinor(60000, "JPY"),
      categoryBudgets: new Map([[KakeiboCategory.NEEDS, Money.ofMinor(150000, "JPY")]]),
    });
    await repo.save(plan);

    const loaded = await repo.findByMonth(YearMonth.parse("2026-05"));
    expect(loaded?.id).toBe("plan-1");
    expect(loaded?.availableToSpend().amount).toBe(240000);
    expect(loaded?.budgetFor(KakeiboCategory.NEEDS).amount).toBe(150000);
  });

  test("round-trips the base-currency amounts of a foreign plan", async () => {
    const repo = new SqliteMonthlyPlanRepository(db);
    await repo.save(
      new MonthlyPlan({
        id: "plan-usd",
        month: YearMonth.parse("2026-05"),
        plannedIncome: Money.ofMinor(200000, "USD"),
        savingsGoal: Money.ofMinor(50000, "USD"),
        categoryBudgets: new Map([[KakeiboCategory.NEEDS, Money.ofMinor(100000, "USD")]]),
        basePlannedIncome: Money.ofMinor(300000, "JPY"),
        baseSavingsGoal: Money.ofMinor(75000, "JPY"),
        baseCategoryBudgets: new Map([[KakeiboCategory.NEEDS, Money.ofMinor(150000, "JPY")]]),
      }),
    );
    const loaded = await repo.findByMonth(YearMonth.parse("2026-05"));
    expect(loaded?.currency).toBe("USD");
    expect(loaded?.baseCurrency).toBe("JPY");
    expect(loaded?.baseAvailableToSpend().amount).toBe(225000);
    expect(loaded?.baseBudgetFor(KakeiboCategory.NEEDS).amount).toBe(150000);
  });

  test("save acts as an upsert keyed by month", async () => {
    const repo = new SqliteMonthlyPlanRepository(db);
    const month = YearMonth.parse("2026-05");
    await repo.save(
      new MonthlyPlan({
        id: "plan-1",
        month,
        plannedIncome: Money.ofMinor(300000, "JPY"),
        savingsGoal: Money.ofMinor(60000, "JPY"),
        categoryBudgets: new Map(),
      }),
    );
    await repo.save(
      new MonthlyPlan({
        id: "plan-1",
        month,
        plannedIncome: Money.ofMinor(320000, "JPY"),
        savingsGoal: Money.ofMinor(80000, "JPY"),
        categoryBudgets: new Map(),
      }),
    );
    const loaded = await repo.findByMonth(month);
    expect(loaded?.savingsGoal.amount).toBe(80000);
  });
});

describe("SqliteReflectionRepository", () => {
  test("round-trips reflection answers", async () => {
    const repo = new SqliteReflectionRepository(db);
    const reflection = new Reflection({
      id: "ref-1",
      month: YearMonth.parse("2026-05"),
      answers: new Map([
        ["howMuchSaved", "¥110,000"],
        ["howToImprove", "Eat out less"],
      ]),
    });
    await repo.save(reflection);

    const loaded = await repo.findByMonth(YearMonth.parse("2026-05"));
    expect(loaded?.answerFor("howMuchSaved")).toBe("¥110,000");
    expect(loaded?.answerFor("howToImprove")).toBe("Eat out less");
  });

  test("returns null when no reflection exists", async () => {
    const repo = new SqliteReflectionRepository(db);
    expect(await repo.findByMonth(YearMonth.parse("2030-01"))).toBeNull();
  });
});
