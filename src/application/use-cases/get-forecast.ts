import { buildMonthlyForecast, type MonthlyForecast } from "../../domain/monthly-forecast.ts";
import { YearMonth } from "../../domain/year-month.ts";
import {
  type RecurringExpenseRepository,
  type RecurringPostingLog,
} from "../ports/recurring-repositories.ts";
import {
  type MonthlyPlanRepository,
  type TransactionRepository,
} from "../ports/repositories.ts";

/**
 * Produces the end-of-month balance forecast for a month by gathering its
 * transactions, plan, recurring expenses, and posting state, then delegating
 * the projection to the {@link buildMonthlyForecast} domain service.
 */
export class GetForecast {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly plans: MonthlyPlanRepository,
    private readonly recurring: RecurringExpenseRepository,
    private readonly postingLog: RecurringPostingLog,
    private readonly defaultCurrency: string,
  ) {}

  async execute(month: string | YearMonth): Promise<MonthlyForecast> {
    const yearMonth = typeof month === "string" ? YearMonth.parse(month) : month;

    const [transactions, plan, recurringExpenses, postedIds] = await Promise.all([
      this.transactions.findByMonth(yearMonth),
      this.plans.findByMonth(yearMonth),
      this.recurring.listAll(),
      this.postingLog.postedIds(yearMonth),
    ]);

    return buildMonthlyForecast({
      month: yearMonth,
      currency: this.defaultCurrency,
      plan,
      transactions,
      recurringExpenses,
      isPosted: (id) => postedIds.has(id),
    });
  }
}
