import { Money } from "./money.ts";
import { type MonthlyPlan } from "./monthly-plan.ts";
import { type RecurringExpense } from "./recurring-expense.ts";
import { type Transaction } from "./transaction.ts";
import { type YearMonth } from "./year-month.ts";

export interface MonthlyForecastInput {
  readonly month: YearMonth;
  readonly currency: string;
  readonly plan: MonthlyPlan | null;
  readonly transactions: readonly Transaction[];
  /** Active recurring expenses to project for the month. */
  readonly recurringExpenses: readonly RecurringExpense[];
  /** Whether a recurring expense has already been auto-posted this month. */
  readonly isPosted: (recurringId: string) => boolean;
}

/**
 * Projected end-of-month picture, combining what has already happened with
 * what is still expected (unposted recurring expenses).
 */
export interface MonthlyForecast {
  readonly month: YearMonth;
  readonly currency: string;
  /** Income we expect this month: the plan's figure, or actual income if no plan. */
  readonly expectedIncome: Money;
  readonly actualIncome: Money;
  readonly actualExpense: Money;
  /** Sum of active recurring expenses not yet posted this month. */
  readonly recurringRemaining: Money;
  /** actualExpense + recurringRemaining. */
  readonly projectedExpense: Money;
  /** expectedIncome − projectedExpense: the forecast leftover / savings. */
  readonly projectedNet: Money;
  readonly savingsGoal: Money;
  /** True when the projected net still meets the plan's savings goal. */
  readonly onTrack: boolean;
}

/**
 * Builds the {@link MonthlyForecast}. Pure and deterministic.
 *
 * A recurring expense is counted in `recurringRemaining` only when it has not
 * yet been posted, so once it is auto-posted (becoming a real transaction in
 * `actualExpense`) it is not double-counted.
 *
 * All monetary inputs must share `currency`.
 */
export function buildMonthlyForecast(input: MonthlyForecastInput): MonthlyForecast {
  const { month, currency, plan, transactions, recurringExpenses, isPosted } = input;
  const zero = Money.zero(currency);

  let actualIncome = zero;
  let actualExpense = zero;
  for (const tx of transactions) {
    if (tx.isIncome()) {
      actualIncome = actualIncome.add(tx.amount);
    } else {
      actualExpense = actualExpense.add(tx.amount);
    }
  }

  let recurringRemaining = zero;
  for (const recurring of recurringExpenses) {
    if (recurring.active && !isPosted(recurring.id)) {
      recurringRemaining = recurringRemaining.add(recurring.amount);
    }
  }

  const expectedIncome = plan?.plannedIncome ?? actualIncome;
  const savingsGoal = plan?.savingsGoal ?? zero;
  const projectedExpense = actualExpense.add(recurringRemaining);
  const projectedNet = expectedIncome.subtract(projectedExpense);

  return {
    month,
    currency,
    expectedIncome,
    actualIncome,
    actualExpense,
    recurringRemaining,
    projectedExpense,
    projectedNet,
    savingsGoal,
    onTrack: projectedNet.compareTo(savingsGoal) >= 0,
  };
}
