import { describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { BusinessRuleError, CurrencyMismatchError } from "../../src/domain/errors.ts";
import { Money } from "../../src/domain/money.ts";
import { MonthlyPlan, type MonthlyPlanProps } from "../../src/domain/monthly-plan.ts";
import { YearMonth } from "../../src/domain/year-month.ts";

const month = YearMonth.parse("2026-05");
const jpy = (amount: number) => Money.ofMinor(amount, "JPY");

function buildPlan(overrides: Partial<MonthlyPlanProps> = {}) {
  return new MonthlyPlan({
    id: "p1",
    month,
    plannedIncome: jpy(300000),
    savingsGoal: jpy(60000),
    categoryBudgets: new Map([
      [KakeiboCategory.NEEDS, jpy(150000)],
      [KakeiboCategory.WANTS, jpy(50000)],
    ]),
    ...overrides,
  });
}

describe("MonthlyPlan", () => {
  test("availableToSpend is planned income minus savings goal", () => {
    const plan = buildPlan();
    expect(plan.availableToSpend().amount).toBe(240000);
  });

  test("budgetFor returns the set budget or zero", () => {
    const plan = buildPlan();
    expect(plan.budgetFor(KakeiboCategory.NEEDS).amount).toBe(150000);
    expect(plan.budgetFor(KakeiboCategory.CULTURE).amount).toBe(0);
  });

  test("totalCategoryBudget sums every category ceiling", () => {
    const plan = buildPlan();
    expect(plan.totalCategoryBudget().amount).toBe(200000);
  });

  test("rejects a savings goal greater than planned income", () => {
    expect(() => buildPlan({ savingsGoal: jpy(400000) })).toThrow(BusinessRuleError);
  });

  test("rejects a negative savings goal", () => {
    expect(() => buildPlan({ savingsGoal: jpy(-1) })).toThrow(BusinessRuleError);
  });

  test("rejects mixed currencies across fields", () => {
    expect(() => buildPlan({ savingsGoal: Money.ofMinor(100, "USD") })).toThrow(
      CurrencyMismatchError,
    );
  });

  test("rejects a category budget in another currency", () => {
    expect(() =>
      buildPlan({ categoryBudgets: new Map([[KakeiboCategory.NEEDS, Money.ofMinor(1, "USD")]]) }),
    ).toThrow(CurrencyMismatchError);
  });

  test("defensively copies the category budget map", () => {
    const budgets = new Map([[KakeiboCategory.NEEDS, jpy(150000)]]);
    const plan = buildPlan({ categoryBudgets: budgets });
    budgets.set(KakeiboCategory.NEEDS, jpy(999));
    expect(plan.budgetFor(KakeiboCategory.NEEDS).amount).toBe(150000);
  });
});

describe("MonthlyPlan base-currency view", () => {
  test("base amounts default to the plan's own currency", () => {
    const plan = buildPlan();
    expect(plan.baseCurrency).toBe("JPY");
    expect(plan.basePlannedIncome.equals(plan.plannedIncome)).toBe(true);
    expect(plan.baseSavingsGoal.equals(plan.savingsGoal)).toBe(true);
    expect(plan.baseAvailableToSpend().amount).toBe(240000);
    expect(plan.baseBudgetFor(KakeiboCategory.NEEDS).amount).toBe(150000);
  });

  test("keeps distinct base-currency amounts when provided", () => {
    const usd = (amount: number) => Money.ofMinor(amount, "USD");
    const plan = buildPlan({
      plannedIncome: usd(200000), // $2,000.00
      savingsGoal: usd(50000), // $500.00
      categoryBudgets: new Map([[KakeiboCategory.NEEDS, usd(100000)]]),
      basePlannedIncome: jpy(300000), // ¥300,000 at a booking rate of 150
      baseSavingsGoal: jpy(75000),
      baseCategoryBudgets: new Map([[KakeiboCategory.NEEDS, jpy(150000)]]),
    });
    expect(plan.currency).toBe("USD");
    expect(plan.baseCurrency).toBe("JPY");
    expect(plan.baseAvailableToSpend().amount).toBe(225000);
    expect(plan.baseBudgetFor(KakeiboCategory.NEEDS).amount).toBe(150000);
  });

  test("rejects mixed currencies across the base fields", () => {
    expect(() => buildPlan({ baseSavingsGoal: Money.ofMinor(1, "USD") })).toThrow(
      CurrencyMismatchError,
    );
  });
});
