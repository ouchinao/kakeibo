import { type Database } from "bun:sqlite";
import { type KakeiboCategory, toKakeiboCategory } from "../../domain/category.ts";
import { Money } from "../../domain/money.ts";
import { MonthlyPlan } from "../../domain/monthly-plan.ts";
import { YearMonth } from "../../domain/year-month.ts";
import { type MonthlyPlanRepository } from "../../application/ports/repositories.ts";

interface PlanRow {
  month: string;
  id: string;
  currency: string;
  planned_income_minor: number;
  savings_goal_minor: number;
  category_budgets_json: string;
}

function toDomain(row: PlanRow): MonthlyPlan {
  const rawBudgets = JSON.parse(row.category_budgets_json) as Record<string, number>;
  const budgets = new Map<KakeiboCategory, Money>();
  for (const [category, minor] of Object.entries(rawBudgets)) {
    budgets.set(toKakeiboCategory(category), Money.ofMinor(minor, row.currency));
  }
  return new MonthlyPlan({
    id: row.id,
    month: YearMonth.parse(row.month),
    plannedIncome: Money.ofMinor(row.planned_income_minor, row.currency),
    savingsGoal: Money.ofMinor(row.savings_goal_minor, row.currency),
    categoryBudgets: budgets,
  });
}

/** SQLite-backed {@link MonthlyPlanRepository}, one row per month. */
export class SqliteMonthlyPlanRepository implements MonthlyPlanRepository {
  constructor(private readonly db: Database) {}

  async save(plan: MonthlyPlan): Promise<void> {
    const budgets: Record<string, number> = {};
    for (const [category, money] of plan.categoryBudgets) {
      budgets[category] = money.amount;
    }
    this.db
      .query(
        `INSERT OR REPLACE INTO monthly_plans
           (month, id, currency, planned_income_minor, savings_goal_minor, category_budgets_json)
         VALUES ($month, $id, $currency, $income, $savings, $budgets)`,
      )
      .run({
        $month: plan.month.toString(),
        $id: plan.id,
        $currency: plan.currency,
        $income: plan.plannedIncome.amount,
        $savings: plan.savingsGoal.amount,
        $budgets: JSON.stringify(budgets),
      });
  }

  async findByMonth(month: YearMonth): Promise<MonthlyPlan | null> {
    const row = this.db
      .query("SELECT * FROM monthly_plans WHERE month = $month")
      .get({ $month: month.toString() }) as PlanRow | null;
    return row === null ? null : toDomain(row);
  }
}
