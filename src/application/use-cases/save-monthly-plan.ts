import { type KakeiboCategory } from "../../domain/category.ts";
import { Money } from "../../domain/money.ts";
import { MonthlyPlan } from "../../domain/monthly-plan.ts";
import { YearMonth } from "../../domain/year-month.ts";
import { type IdGenerator } from "../ports/id-generator.ts";
import { type MonthlyPlanRepository } from "../ports/repositories.ts";

export interface SaveMonthlyPlanCommand {
  readonly month: string | YearMonth;
  readonly currency: string;
  readonly plannedIncomeMinor: number;
  readonly savingsGoalMinor: number;
  /** Optional per-category budget ceilings in minor units. */
  readonly categoryBudgetsMinor?: Partial<Record<KakeiboCategory, number>> | undefined;
}

/**
 * Creates or updates the plan for a month (upsert keyed by month).
 *
 * When a plan already exists for the month its identity is preserved so the
 * operation is idempotent with respect to IDs.
 */
export class SaveMonthlyPlan {
  constructor(
    private readonly plans: MonthlyPlanRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(command: SaveMonthlyPlanCommand): Promise<MonthlyPlan> {
    const month =
      typeof command.month === "string" ? YearMonth.parse(command.month) : command.month;

    const budgets = new Map<KakeiboCategory, Money>();
    for (const [category, amount] of Object.entries(command.categoryBudgetsMinor ?? {})) {
      if (amount !== undefined) {
        budgets.set(category as KakeiboCategory, Money.ofMinor(amount, command.currency));
      }
    }

    const existing = await this.plans.findByMonth(month);

    const plan = new MonthlyPlan({
      id: existing?.id ?? this.idGenerator.next(),
      month,
      plannedIncome: Money.ofMinor(command.plannedIncomeMinor, command.currency),
      savingsGoal: Money.ofMinor(command.savingsGoalMinor, command.currency),
      categoryBudgets: budgets,
    });

    await this.plans.save(plan);
    return plan;
  }
}
