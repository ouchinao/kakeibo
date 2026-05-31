import { beforeEach, describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { YearMonth } from "../../src/domain/year-month.ts";
import { NotFoundError } from "../../src/application/errors.ts";
import { CreateRecurringExpense } from "../../src/application/use-cases/create-recurring-expense.ts";
import { DeleteRecurringExpense } from "../../src/application/use-cases/delete-recurring-expense.ts";
import { GetForecast } from "../../src/application/use-cases/get-forecast.ts";
import { ListRecurringExpenses } from "../../src/application/use-cases/list-recurring-expenses.ts";
import { PostRecurringExpenses } from "../../src/application/use-cases/post-recurring-expenses.ts";
import { SaveMonthlyPlan } from "../../src/application/use-cases/save-monthly-plan.ts";
import {
  InMemoryRecurringExpenseRepository,
  InMemoryRecurringPostingLog,
} from "../../src/infrastructure/persistence/in-memory-recurring-repositories.ts";
import {
  InMemoryMonthlyPlanRepository,
  InMemoryTransactionRepository,
} from "../../src/infrastructure/persistence/in-memory-repositories.ts";
import { SequentialIdGenerator } from "../support/fakes.ts";

describe("recurring expense use cases", () => {
  let recurringRepo: InMemoryRecurringExpenseRepository;
  let postingLog: InMemoryRecurringPostingLog;
  let txRepo: InMemoryTransactionRepository;
  let planRepo: InMemoryMonthlyPlanRepository;
  let create: CreateRecurringExpense;
  let list: ListRecurringExpenses;
  let remove: DeleteRecurringExpense;
  let post: PostRecurringExpenses;
  let forecast: GetForecast;
  let savePlan: SaveMonthlyPlan;

  beforeEach(() => {
    recurringRepo = new InMemoryRecurringExpenseRepository();
    postingLog = new InMemoryRecurringPostingLog();
    txRepo = new InMemoryTransactionRepository();
    planRepo = new InMemoryMonthlyPlanRepository();
    const ids = new SequentialIdGenerator();
    create = new CreateRecurringExpense(recurringRepo, ids);
    list = new ListRecurringExpenses(recurringRepo);
    remove = new DeleteRecurringExpense(recurringRepo);
    post = new PostRecurringExpenses(recurringRepo, postingLog, txRepo, ids);
    forecast = new GetForecast(txRepo, planRepo, recurringRepo, postingLog, "JPY");
    savePlan = new SaveMonthlyPlan(planRepo, ids);
  });

  const addRent = () =>
    create.execute({
      name: "Rent",
      amountMinor: 85000,
      currency: "JPY",
      category: KakeiboCategory.NEEDS,
      dayOfMonth: 1,
    });

  test("creates and lists recurring expenses", async () => {
    await addRent();
    const all = await list.execute();
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe("Rent");
  });

  test("deletes a recurring expense", async () => {
    const rent = await addRent();
    await remove.execute(rent.id);
    expect(await list.execute()).toHaveLength(0);
  });

  test("deleting a missing recurring expense throws NotFoundError", async () => {
    await expect(remove.execute("nope")).rejects.toThrow(NotFoundError);
  });

  test("posts active recurring expenses as transactions for a month", async () => {
    await addRent();
    const result = await post.execute("2026-05");

    expect(result.posted).toBe(1);
    const txs = await txRepo.findByMonth(YearMonth.parse("2026-05"));
    expect(txs).toHaveLength(1);
    expect(txs[0]?.amount.amount).toBe(85000);
    expect(txs[0]?.note).toBe("Rent");
    expect(txs[0]?.occurredAt.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  test("posting is idempotent for the same month", async () => {
    await addRent();
    await post.execute("2026-05");
    const second = await post.execute("2026-05");

    expect(second.posted).toBe(0);
    expect(await txRepo.findByMonth(YearMonth.parse("2026-05"))).toHaveLength(1);
  });

  test("posting again applies to a different month", async () => {
    await addRent();
    await post.execute("2026-05");
    const june = await post.execute("2026-06");
    expect(june.posted).toBe(1);
  });

  test("forecast counts recurring as remaining until posted, then as actual", async () => {
    await savePlan.execute({
      month: "2026-05",
      currency: "JPY",
      plannedIncomeMinor: 300000,
      savingsGoalMinor: 50000,
    });
    await addRent();

    const before = await forecast.execute("2026-05");
    expect(before.recurringRemaining.amount).toBe(85000);
    expect(before.actualExpense.amount).toBe(0);
    expect(before.projectedExpense.amount).toBe(85000);

    await post.execute("2026-05");

    const after = await forecast.execute("2026-05");
    expect(after.recurringRemaining.amount).toBe(0);
    expect(after.actualExpense.amount).toBe(85000);
    expect(after.projectedExpense.amount).toBe(85000); // unchanged: no double counting
    expect(after.projectedNet.amount).toBe(215000);
  });
});
