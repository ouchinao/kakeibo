import { buildMonthlySummary, type MonthlySummary } from "../../domain/monthly-summary.ts";
import { YearMonth } from "../../domain/year-month.ts";
import {
  type MonthlyPlanRepository,
  type TransactionRepository,
} from "../ports/repositories.ts";

/**
 * Assembles the {@link MonthlySummary} read model for a month by gathering its
 * transactions and plan, then delegating the calculation to the domain.
 *
 * The working currency comes from the month's plan when present; otherwise the
 * configured default currency is used (so an unplanned month still summarises).
 */
export class GetMonthlySummary {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly plans: MonthlyPlanRepository,
    private readonly defaultCurrency: string,
  ) {}

  async execute(month: string | YearMonth): Promise<MonthlySummary> {
    const yearMonth = typeof month === "string" ? YearMonth.parse(month) : month;

    const [transactions, plan] = await Promise.all([
      this.transactions.findByMonth(yearMonth),
      this.plans.findByMonth(yearMonth),
    ]);

    return buildMonthlySummary({
      month: yearMonth,
      currency: plan?.currency ?? this.defaultCurrency,
      transactions,
      plan,
    });
  }
}
