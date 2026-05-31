import { type Money } from "../../domain/money.ts";
import { buildMonthlySummary } from "../../domain/monthly-summary.ts";
import { YearMonth } from "../../domain/year-month.ts";
import { ApplicationError } from "../errors.ts";
import {
  type MonthlyPlanRepository,
  type TransactionRepository,
} from "../ports/repositories.ts";

/** Key figures for a single month in a trend series. */
export interface TrendPoint {
  readonly month: YearMonth;
  readonly totalIncome: Money;
  readonly totalExpense: Money;
  /** totalIncome − totalExpense for the month. */
  readonly actualSavings: Money;
  readonly savingsGoal: Money;
  readonly savingsGoalMet: boolean;
}

const MAX_MONTHS = 24;

/**
 * Builds a chronological trend series ending at `endMonth` and spanning
 * `months` months, reusing the {@link buildMonthlySummary} domain calculation
 * for each month so the figures match the single-month summary exactly.
 */
export class GetTrend {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly plans: MonthlyPlanRepository,
    private readonly defaultCurrency: string,
  ) {}

  async execute(endMonth: string | YearMonth, months: number): Promise<TrendPoint[]> {
    if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) {
      throw new ApplicationError(`'months' must be an integer between 1 and ${MAX_MONTHS}`);
    }
    const end = typeof endMonth === "string" ? YearMonth.parse(endMonth) : endMonth;

    // Oldest first so the series reads left-to-right in time.
    const targets: YearMonth[] = [];
    for (let offset = months - 1; offset >= 0; offset -= 1) {
      targets.push(end.minusMonths(offset));
    }

    return Promise.all(
      targets.map(async (month) => {
        const [transactions, plan] = await Promise.all([
          this.transactions.findByMonth(month),
          this.plans.findByMonth(month),
        ]);
        const summary = buildMonthlySummary({
          month,
          currency: plan?.currency ?? this.defaultCurrency,
          transactions,
          plan,
        });
        return {
          month: summary.month,
          totalIncome: summary.totalIncome,
          totalExpense: summary.totalExpense,
          actualSavings: summary.actualSavings,
          savingsGoal: summary.savingsGoal,
          savingsGoalMet: summary.savingsGoalMet,
        };
      }),
    );
  }
}
