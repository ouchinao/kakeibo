import { describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { Money } from "../../src/domain/money.ts";
import { buildMonthlyForecast } from "../../src/domain/monthly-forecast.ts";
import { MonthlyPlan } from "../../src/domain/monthly-plan.ts";
import { RecurringExpense } from "../../src/domain/recurring-expense.ts";
import { Transaction, TransactionType } from "../../src/domain/transaction.ts";
import { YearMonth } from "../../src/domain/year-month.ts";

const month = YearMonth.parse("2026-05");
const jpy = (n: number) => Money.ofMinor(n, "JPY");

function recurring(id: string, amount: number, active = true): RecurringExpense {
  return new RecurringExpense({
    id,
    name: id,
    amount: jpy(amount),
    category: KakeiboCategory.NEEDS,
    dayOfMonth: 1,
    active,
  });
}

function expense(amount: number): Transaction {
  return new Transaction({
    id: `tx-${amount}`,
    type: TransactionType.EXPENSE,
    amount: jpy(amount),
    category: KakeiboCategory.NEEDS,
    occurredAt: new Date("2026-05-10T00:00:00Z"),
    note: "",
  });
}

const plan = new MonthlyPlan({
  id: "p1",
  month,
  plannedIncome: jpy(300000),
  savingsGoal: jpy(50000),
  categoryBudgets: new Map(),
});

describe("buildMonthlyForecast", () => {
  test("projects expected income minus actual and remaining recurring expenses", () => {
    const forecast = buildMonthlyForecast({
      month,
      currency: "JPY",
      plan,
      transactions: [expense(40000)],
      recurringExpenses: [recurring("rent", 85000), recurring("netflix", 1500)],
      isPosted: () => false,
    });

    expect(forecast.actualExpense.amount).toBe(40000);
    expect(forecast.recurringRemaining.amount).toBe(86500);
    expect(forecast.projectedExpense.amount).toBe(126500);
    expect(forecast.projectedNet.amount).toBe(173500); // 300000 - 126500
    expect(forecast.onTrack).toBe(true);
  });

  test("does not count recurring expenses already posted", () => {
    const forecast = buildMonthlyForecast({
      month,
      currency: "JPY",
      plan,
      transactions: [expense(85000)], // the posted rent already shows up here
      recurringExpenses: [recurring("rent", 85000), recurring("netflix", 1500)],
      isPosted: (id) => id === "rent",
    });

    expect(forecast.recurringRemaining.amount).toBe(1500); // only netflix remains
    expect(forecast.projectedExpense.amount).toBe(86500);
  });

  test("ignores inactive recurring expenses", () => {
    const forecast = buildMonthlyForecast({
      month,
      currency: "JPY",
      plan,
      transactions: [],
      recurringExpenses: [recurring("gym", 5000, false)],
      isPosted: () => false,
    });
    expect(forecast.recurringRemaining.amount).toBe(0);
  });

  test("flags when the projection falls short of the savings goal", () => {
    const forecast = buildMonthlyForecast({
      month,
      currency: "JPY",
      plan,
      transactions: [expense(200000)],
      recurringExpenses: [recurring("rent", 85000)],
      isPosted: () => false,
    });
    expect(forecast.projectedNet.amount).toBe(15000); // 300000 - 285000
    expect(forecast.onTrack).toBe(false); // below 50,000 goal
  });

  test("falls back to actual income when there is no plan", () => {
    const income = new Transaction({
      id: "inc",
      type: TransactionType.INCOME,
      amount: jpy(120000),
      occurredAt: new Date("2026-05-01T00:00:00Z"),
      note: "",
    });
    const forecast = buildMonthlyForecast({
      month,
      currency: "JPY",
      plan: null,
      transactions: [income],
      recurringExpenses: [],
      isPosted: () => false,
    });
    expect(forecast.expectedIncome.amount).toBe(120000);
    expect(forecast.savingsGoal.amount).toBe(0);
  });
});
