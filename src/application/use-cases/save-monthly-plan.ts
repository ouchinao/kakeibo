import { type KakeiboCategory } from "../../domain/category.ts";
import { ExchangeRate } from "../../domain/exchange-rate.ts";
import { Money } from "../../domain/money.ts";
import { MonthlyPlan } from "../../domain/monthly-plan.ts";
import { YearMonth } from "../../domain/year-month.ts";
import { ApplicationError } from "../errors.ts";
import { type IdGenerator } from "../ports/id-generator.ts";
import { type MonthlyPlanRepository } from "../ports/repositories.ts";

export interface SaveMonthlyPlanCommand {
  readonly month: string | YearMonth;
  readonly currency: string;
  readonly plannedIncomeMinor: number;
  readonly savingsGoalMinor: number;
  /** Optional per-category budget ceilings in minor units. */
  readonly categoryBudgetsMinor?: Partial<Record<KakeiboCategory, number>> | undefined;
  /**
   * Exchange rate from the plan's currency to the base currency. Ignored when
   * already in the base currency; **required** otherwise (we never guess a
   * rate), so a foreign plan still applies to the base-currency summary.
   */
  readonly rate?: number | undefined;
}

/**
 * Creates or updates the plan for a month (upsert keyed by month).
 *
 * When a plan already exists for the month its identity is preserved so the
 * operation is idempotent with respect to IDs. Every monetary field is also
 * recorded in the base currency (via the supplied rate) so aggregations work
 * regardless of the plan's own currency.
 */
export class SaveMonthlyPlan {
  constructor(
    private readonly plans: MonthlyPlanRepository,
    private readonly idGenerator: IdGenerator,
    private readonly baseCurrency: string,
  ) {}

  async execute(command: SaveMonthlyPlanCommand): Promise<MonthlyPlan> {
    const month =
      typeof command.month === "string" ? YearMonth.parse(command.month) : command.month;

    const toBase = this.baseConverter(command.currency, command.rate);

    const budgets = new Map<KakeiboCategory, Money>();
    const baseBudgets = new Map<KakeiboCategory, Money>();
    for (const [category, amount] of Object.entries(command.categoryBudgetsMinor ?? {})) {
      if (amount !== undefined) {
        const money = Money.ofMinor(amount, command.currency);
        budgets.set(category as KakeiboCategory, money);
        baseBudgets.set(category as KakeiboCategory, toBase(money));
      }
    }

    const plannedIncome = Money.ofMinor(command.plannedIncomeMinor, command.currency);
    const savingsGoal = Money.ofMinor(command.savingsGoalMinor, command.currency);

    const existing = await this.plans.findByMonth(month);

    const plan = new MonthlyPlan({
      id: existing?.id ?? this.idGenerator.next(),
      month,
      plannedIncome,
      savingsGoal,
      categoryBudgets: budgets,
      basePlannedIncome: toBase(plannedIncome),
      baseSavingsGoal: toBase(savingsGoal),
      baseCategoryBudgets: baseBudgets,
    });

    await this.plans.save(plan);
    return plan;
  }

  /**
   * Builds a function that converts a plan amount to the base currency. The
   * rate is required (and validated) once for a foreign-currency plan; an
   * already-base plan converts via the identity.
   */
  private baseConverter(currency: string, rate: number | undefined): (money: Money) => Money {
    if (currency === this.baseCurrency) {
      return (money) => money;
    }
    if (rate === undefined) {
      throw new ApplicationError(
        `A rate to ${this.baseCurrency} is required for a ${currency} plan`,
      );
    }
    const exchange = ExchangeRate.of(currency, this.baseCurrency, rate);
    return (money) => exchange.convert(money);
  }
}
