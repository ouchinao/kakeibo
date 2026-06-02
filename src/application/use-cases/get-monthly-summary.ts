import { buildMonthlySummary, type MonthlySummary } from "../../domain/monthly-summary.ts";
import { YearMonth } from "../../domain/year-month.ts";
import type { MonthlyPlanRepository, TransactionRepository } from "../ports/repositories.ts";

/**
 * Assembles the {@link MonthlySummary} read model for a month by gathering its
 * transactions and plan, then delegating the calculation to the domain.
 *
 * The working currency comes from the month's plan when present; otherwise the
 * caller-supplied `currency` override is used, falling back to the configured
 * default (so an unplanned month still summarises in the viewer's currency).
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

    // Aggregate in the base currency; transactions carry their baseAmount.
    return buildMonthlySummary({
      month: yearMonth,
      currency: this.defaultCurrency,
      transactions,
      plan,
    });
  }
}
