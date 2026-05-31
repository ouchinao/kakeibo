import { beforeEach, describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { TransactionType } from "../../src/domain/transaction.ts";
import { ApplicationError } from "../../src/application/errors.ts";
import { GetTrend } from "../../src/application/use-cases/get-trend.ts";
import { RecordTransaction } from "../../src/application/use-cases/record-transaction.ts";
import { SaveMonthlyPlan } from "../../src/application/use-cases/save-monthly-plan.ts";
import {
  InMemoryMonthlyPlanRepository,
  InMemoryTransactionRepository,
} from "../../src/infrastructure/persistence/in-memory-repositories.ts";
import { FixedClock, SequentialIdGenerator } from "../support/fakes.ts";

describe("GetTrend", () => {
  let txRepo: InMemoryTransactionRepository;
  let planRepo: InMemoryMonthlyPlanRepository;
  let record: RecordTransaction;
  let savePlan: SaveMonthlyPlan;
  let trend: GetTrend;

  beforeEach(() => {
    txRepo = new InMemoryTransactionRepository();
    planRepo = new InMemoryMonthlyPlanRepository();
    const ids = new SequentialIdGenerator();
    record = new RecordTransaction(txRepo, ids, new FixedClock(new Date("2026-05-15T00:00:00Z")));
    savePlan = new SaveMonthlyPlan(planRepo, ids);
    trend = new GetTrend(txRepo, planRepo, "JPY");
  });

  test("returns a chronological series of the requested length", async () => {
    const points = await trend.execute("2026-05", 6);
    expect(points.map((p) => p.month.toString())).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
    ]);
  });

  test("aggregates each month's income, expense, and savings", async () => {
    await savePlan.execute({
      month: "2026-05",
      currency: "JPY",
      plannedIncomeMinor: 300000,
      savingsGoalMinor: 50000,
    });
    await record.execute({
      type: TransactionType.INCOME,
      amountMinor: 300000,
      currency: "JPY",
      occurredAt: new Date("2026-05-01T00:00:00Z"),
    });
    await record.execute({
      type: TransactionType.EXPENSE,
      amountMinor: 120000,
      currency: "JPY",
      category: KakeiboCategory.NEEDS,
      occurredAt: new Date("2026-04-10T00:00:00Z"),
    });

    const points = await trend.execute("2026-05", 3); // Mar, Apr, May
    const april = points.find((p) => p.month.toString() === "2026-04");
    const may = points.find((p) => p.month.toString() === "2026-05");

    expect(april?.totalExpense.amount).toBe(120000);
    expect(april?.actualSavings.amount).toBe(-120000);
    expect(may?.totalIncome.amount).toBe(300000);
    expect(may?.actualSavings.amount).toBe(300000);
    expect(may?.savingsGoalMet).toBe(true);
  });

  test.each([0, -1, 25, 1.5])("rejects an invalid month count: %p", async (months) => {
    await expect(trend.execute("2026-05", months)).rejects.toThrow(ApplicationError);
  });
});
