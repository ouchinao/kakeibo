import type { MonthlyPlan } from "../../domain/monthly-plan.ts";
import { YearMonth } from "../../domain/year-month.ts";
import type { MonthlyPlanRepository } from "../ports/repositories.ts";

/** Fetches the plan for a month, or null when none has been created yet. */
export class GetMonthlyPlan {
  constructor(private readonly plans: MonthlyPlanRepository) {}

  async execute(month: string | YearMonth): Promise<MonthlyPlan | null> {
    const yearMonth = typeof month === "string" ? YearMonth.parse(month) : month;
    return this.plans.findByMonth(yearMonth);
  }
}
