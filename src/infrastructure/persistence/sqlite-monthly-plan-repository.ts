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
  base_currency: string | null;
  base_planned_income_minor: number | null;
  base_savings_goal_minor: number | null;
  base_category_budgets_json: string | null;
}

function parseBudgets(json: string, currency: string): Map<KakeiboCategory, Money> {
  const raw = JSON.parse(json) as Record<string, number>;
  const budgets = new Map<KakeiboCategory, Money>();
  for (const [category, minor] of Object.entries(raw)) {
    budgets.set(toKakeiboCategory(category), Money.ofMinor(minor, currency));
  }
  return budgets;
}

function toDomain(row: PlanRow): MonthlyPlan {
  const budgets = parseBudgets(row.category_budgets_json, row.currency);
  // Legacy rows have no base columns; the entity then defaults the base view to
  // the own-currency fields.
  const hasBase =
    row.base_currency !== null &&
    row.base_planned_income_minor !== null &&
    row.base_savings_goal_minor !== null;
  return new MonthlyPlan({
    id: row.id,
    month: YearMonth.parse(row.month),
    plannedIncome: Money.ofMinor(row.planned_income_minor, row.currency),
    savingsGoal: Money.ofMinor(row.savings_goal_minor, row.currency),
    categoryBudgets: budgets,
    basePlannedIncome: hasBase
      ? Money.ofMinor(row.base_planned_income_minor as number, row.base_currency as string)
      : undefined,
    baseSavingsGoal: hasBase
      ? Money.ofMinor(row.base_savings_goal_minor as number, row.base_currency as string)
      : undefined,
    baseCategoryBudgets: hasBase
      ? parseBudgets(row.base_category_budgets_json ?? "{}", row.base_currency as string)
      : undefined,
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
    const baseBudgets: Record<string, number> = {};
    for (const [category, money] of plan.baseCategoryBudgets) {
      baseBudgets[category] = money.amount;
    }
    this.db
      .query(
        `INSERT OR REPLACE INTO monthly_plans
           (month, id, currency, planned_income_minor, savings_goal_minor, category_budgets_json,
            base_currency, base_planned_income_minor, base_savings_goal_minor,
            base_category_budgets_json)
         VALUES ($month, $id, $currency, $income, $savings, $budgets,
            $baseCurrency, $baseIncome, $baseSavings, $baseBudgets)`,
      )
      .run({
        $month: plan.month.toString(),
        $id: plan.id,
        $currency: plan.currency,
        $income: plan.plannedIncome.amount,
        $savings: plan.savingsGoal.amount,
        $budgets: JSON.stringify(budgets),
        $baseCurrency: plan.baseCurrency,
        $baseIncome: plan.basePlannedIncome.amount,
        $baseSavings: plan.baseSavingsGoal.amount,
        $baseBudgets: JSON.stringify(baseBudgets),
      });
  }

  async findByMonth(month: YearMonth): Promise<MonthlyPlan | null> {
    const row = this.db
      .query("SELECT * FROM monthly_plans WHERE month = $month")
      .get({ $month: month.toString() }) as PlanRow | null;
    return row === null ? null : toDomain(row);
  }
}
