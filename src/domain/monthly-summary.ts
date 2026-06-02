import { ALL_CATEGORIES, type KakeiboCategory } from "./category.ts";
import { Money } from "./money.ts";
import type { MonthlyPlan } from "./monthly-plan.ts";
import type { Transaction } from "./transaction.ts";
import type { YearMonth } from "./year-month.ts";

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
 * This is a single-currency view: transactions whose currency differs from
 * `currency` are excluded (full multi-currency support is future work).
 */
export function buildMonthlySummary(input: MonthlySummaryInput): MonthlySummary {
  const { month, currency, transactions, plan } = input;
  const zero = Money.zero(currency);

  // `currency` is the base currency; transactions carry their amount converted
  // to it (baseAmount), so mixed-currency months aggregate correctly. A tx
  // whose baseAmount is in another currency (legacy data) is skipped rather
  // than crashing. A plan applies via its base-currency fields, so a plan in
  // any currency is honoured once converted.
  const effectivePlan = plan !== null && plan.baseCurrency === currency ? plan : null;

  let totalIncome = zero;
  let totalExpense = zero;
  const spentByCategory = new Map<KakeiboCategory, Money>();

  for (const tx of transactions) {
    if (tx.baseAmount.currency !== currency) continue;

    if (tx.isIncome()) {
      totalIncome = totalIncome.add(tx.baseAmount);
    } else {
      totalExpense = totalExpense.add(tx.baseAmount);
      const category = tx.category as KakeiboCategory;
      const current = spentByCategory.get(category) ?? zero;
      spentByCategory.set(category, current.add(tx.baseAmount));
    }
  }

  const categories: CategoryBreakdown[] = ALL_CATEGORIES.map((category) => {
    const budget = effectivePlan?.baseBudgetFor(category) ?? zero;
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

  const plannedIncome = effectivePlan?.basePlannedIncome ?? zero;
  const savingsGoal = effectivePlan?.baseSavingsGoal ?? zero;
  const availableToSpend = effectivePlan?.baseAvailableToSpend() ?? zero;
  const actualSavings = totalIncome.subtract(totalExpense);

  return {
    month,
    currency,
    totalIncome,
    totalExpense,
    netBalance: actualSavings,
    hasPlan: effectivePlan !== null,
    plannedIncome,
    savingsGoal,
    availableToSpend,
    remainingToSpend: availableToSpend.subtract(totalExpense),
    actualSavings,
    savingsGoalMet: effectivePlan !== null && actualSavings.compareTo(savingsGoal) >= 0,
    categories,
  };
}
