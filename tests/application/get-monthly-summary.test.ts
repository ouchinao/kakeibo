import { beforeEach, describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { TransactionType } from "../../src/domain/transaction.ts";
import { GetMonthlySummary } from "../../src/application/use-cases/get-monthly-summary.ts";
import { RecordTransaction } from "../../src/application/use-cases/record-transaction.ts";
import { SaveMonthlyPlan } from "../../src/application/use-cases/save-monthly-plan.ts";
import {
  InMemoryMonthlyPlanRepository,
  InMemoryTransactionRepository,
} from "../../src/infrastructure/persistence/in-memory-repositories.ts";
import { FixedClock, SequentialIdGenerator } from "../support/fakes.ts";

describe("GetMonthlySummary", () => {
  let txRepo: InMemoryTransactionRepository;
  let planRepo: InMemoryMonthlyPlanRepository;
  let record: RecordTransaction;
  let savePlan: SaveMonthlyPlan;
  let summary: GetMonthlySummary;

  beforeEach(() => {
    txRepo = new InMemoryTransactionRepository();
    planRepo = new InMemoryMonthlyPlanRepository();
    const ids = new SequentialIdGenerator();
    const clock = new FixedClock(new Date("2026-05-15T00:00:00Z"));
    record = new RecordTransaction(txRepo, ids, clock);
    savePlan = new SaveMonthlyPlan(planRepo, ids);
    summary = new GetMonthlySummary(txRepo, planRepo, "JPY");
  });

  async function spend(amountMinor: number, category: KakeiboCategory): Promise<void> {
    await record.execute({
      type: TransactionType.EXPENSE,
      amountMinor,
      currency: "JPY",
      category,
      occurredAt: new Date("2026-05-10T00:00:00Z"),
    });
  }

  test("summarises a planned month with income and spending", async () => {
    await savePlan.execute({
      month: "2026-05",
      currency: "JPY",
      plannedIncomeMinor: 300000,
      savingsGoalMinor: 60000,
      categoryBudgetsMinor: {
        [KakeiboCategory.NEEDS]: 150000,
        [KakeiboCategory.WANTS]: 50000,
      },
    });
    await record.execute({
      type: TransactionType.INCOME,
      amountMinor: 300000,
      currency: "JPY",
      occurredAt: new Date("2026-05-01T00:00:00Z"),
    });
    await spend(120000, KakeiboCategory.NEEDS);
    await spend(70000, KakeiboCategory.WANTS); // over the 50,000 budget

    const result = await summary.execute("2026-05");

    expect(result.totalIncome.amount).toBe(300000);
    expect(result.totalExpense.amount).toBe(190000);
    expect(result.availableToSpend.amount).toBe(240000);
    expect(result.remainingToSpend.amount).toBe(50000);
    expect(result.actualSavings.amount).toBe(110000);
    expect(result.savingsGoalMet).toBe(true);

    const wants = result.categories.find((c) => c.category === KakeiboCategory.WANTS);
    expect(wants?.spent.amount).toBe(70000);
    expect(wants?.remaining.amount).toBe(-20000);
    expect(wants?.overBudget).toBe(true);

    const culture = result.categories.find((c) => c.category === KakeiboCategory.CULTURE);
    expect(culture?.overBudget).toBe(false);
  });

  test("savings goal is not met when spending eats into it", async () => {
    await savePlan.execute({
      month: "2026-05",
      currency: "JPY",
      plannedIncomeMinor: 300000,
      savingsGoalMinor: 100000,
    });
    await record.execute({
      type: TransactionType.INCOME,
      amountMinor: 300000,
      currency: "JPY",
      occurredAt: new Date("2026-05-01T00:00:00Z"),
    });
    await spend(250000, KakeiboCategory.NEEDS); // saves only 50,000 < goal

    const result = await summary.execute("2026-05");
    expect(result.actualSavings.amount).toBe(50000);
    expect(result.savingsGoalMet).toBe(false);
    expect(result.remainingToSpend.amount).toBe(-50000);
  });

  test("works for an unplanned month using the default currency", async () => {
    await spend(1200, KakeiboCategory.CULTURE);

    const result = await summary.execute("2026-05");
    expect(result.hasPlan).toBe(false);
    expect(result.currency).toBe("JPY");
    expect(result.totalExpense.amount).toBe(1200);
    expect(result.availableToSpend.amount).toBe(0);
    expect(result.savingsGoalMet).toBe(false);
  });

  test("honours a currency override for an unplanned month", async () => {
    await record.execute({
      type: TransactionType.EXPENSE,
      amountMinor: 1234,
      currency: "USD",
      category: KakeiboCategory.WANTS,
      occurredAt: new Date("2026-05-10T00:00:00Z"),
    });

    const result = await summary.execute("2026-05", "USD");
    expect(result.currency).toBe("USD");
    expect(result.totalExpense.amount).toBe(1234);
  });
});
