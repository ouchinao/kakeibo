import { ALL_CATEGORIES, type KakeiboCategory } from "./category.ts";
import { Money } from "./money.ts";
import { type MonthlyPlan } from "./monthly-plan.ts";
import { Transaction } from "./transaction.ts";
import { type YearMonth } from "./year-month.ts";

/** Spending picture for a single kakeibo category within a month. */
export interface CategoryBreakdown {
  readonly category: KakeiboCategory;
  /** Budget ceiling set in the plan (zero when none). */
  readonly budget: Money;
  /** Total spent in this category this month. */
  readonly spent: Money;
  /** budget − spent; negative means the category is over budget. */
  readonly remaining: Money;
  readonly overBudget: boolean;
}

/**
 * Read model answering the central kakeibo questions for one month:
 * how much came in, how much went out, how much is left to spend, and whether
 * the savings goal was met.
 */
export interface MonthlySummary {
  readonly month: YearMonth;
  readonly currency: string;
  readonly totalIncome: Money;
  readonly totalExpense: Money;
  /** totalIncome − totalExpense. */
  readonly netBalance: Money;
  readonly hasPlan: boolean;
  readonly plannedIncome: Money;
  readonly savingsGoal: Money;
  /** plannedIncome − savingsGoal: the kakeibo spending envelope. */
  readonly availableToSpend: Money;
  /** availableToSpend − totalExpense: real-time "money left to spend". */
  readonly remainingToSpend: Money;
  /** totalIncome − totalExpense: what was actually saved this month. */
  readonly actualSavings: Money;
  /** True when actual savings reached the plan's goal. */
  readonly savingsGoalMet: boolean;
  readonly categories: readonly CategoryBreakdown[];
}

export interface MonthlySummaryInput {
  readonly month: YearMonth;
  readonly currency: string;
  readonly transactions: readonly Transaction[];
  readonly plan: MonthlyPlan | null;
}

/**
 * Computes the {@link MonthlySummary} from a month's transactions and optional
 * plan. Pure function — no I/O, fully deterministic, easy to unit test.
 *
 * All monetary inputs must share `currency`; mismatches surface as a
 * `CurrencyMismatchError` from the underlying {@link Money} arithmetic.
 */
export function buildMonthlySummary(input: MonthlySummaryInput): MonthlySummary {
  const { month, currency, transactions, plan } = input;
  const zero = Money.zero(currency);

  let totalIncome = zero;
  let totalExpense = zero;
  const spentByCategory = new Map<KakeiboCategory, Money>();

  for (const tx of transactions) {
    if (tx.isIncome()) {
      totalIncome = totalIncome.add(tx.amount);
    } else {
      totalExpense = totalExpense.add(tx.amount);
      const category = tx.category as KakeiboCategory;
      const current = spentByCategory.get(category) ?? zero;
      spentByCategory.set(category, current.add(tx.amount));
    }
  }

  const categories: CategoryBreakdown[] = ALL_CATEGORIES.map((category) => {
    const budget = plan?.budgetFor(category) ?? zero;
    const spent = spentByCategory.get(category) ?? zero;
    const remaining = budget.subtract(spent);
    return {
      category,
      budget,
      spent,
      remaining,
      // Only meaningful when a budget was actually set for the category.
      overBudget: budget.isPositive() && remaining.isNegative(),
    };
  });

  const plannedIncome = plan?.plannedIncome ?? zero;
  const savingsGoal = plan?.savingsGoal ?? zero;
  const availableToSpend = plan?.availableToSpend() ?? zero;
  const actualSavings = totalIncome.subtract(totalExpense);

  return {
    month,
    currency,
    totalIncome,
    totalExpense,
    netBalance: actualSavings,
    hasPlan: plan !== null,
    plannedIncome,
    savingsGoal,
    availableToSpend,
    remainingToSpend: availableToSpend.subtract(totalExpense),
    actualSavings,
    savingsGoalMet: plan !== null && actualSavings.compareTo(savingsGoal) >= 0,
    categories,
  };
}
