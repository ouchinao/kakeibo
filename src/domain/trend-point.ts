import type { Money } from "./money.ts";
import type { YearMonth } from "./year-month.ts";

/**
 * Key figures for a single month in a trend series.
 *
 * A domain read model (depends only on {@link Money} and {@link YearMonth}) so
 * both the application and interface layers can reference it without the
 * interface layer reaching into a use case.
 */
export interface TrendPoint {
  readonly month: YearMonth;
  readonly totalIncome: Money;
  readonly totalExpense: Money;
  /** totalIncome − totalExpense for the month. */
  readonly actualSavings: Money;
  readonly savingsGoal: Money;
  readonly savingsGoalMet: boolean;
}
