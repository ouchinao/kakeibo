import { ALL_CATEGORIES, type KakeiboCategory } from "./category.ts";
import { BusinessRuleError, CurrencyMismatchError } from "./errors.ts";
import { Money } from "./money.ts";
import { type YearMonth } from "./year-month.ts";

export interface MonthlyPlanProps {
  readonly id: string;
  readonly month: YearMonth;
  /** Income the household expects to receive this month. */
  readonly plannedIncome: Money;
  /** The amount the household commits to save first ("pay yourself first"). */
  readonly savingsGoal: Money;
  /** Optional spending ceiling per kakeibo category. */
  readonly categoryBudgets: ReadonlyMap<KakeiboCategory, Money>;
}

/**
 * The monthly kakeibo plan, created at the start of a month.
 *
 * The signature kakeibo question is: "How much do I have, how much do I want
 * to save, and therefore how much can I spend?" This entity models exactly
 * that, and exposes `availableToSpend()` as the derived budget envelope.
 *
 * Invariants:
 *  - every monetary field must share the plan's currency;
 *  - savings goal cannot exceed planned income (you cannot save more than you
 *    plan to earn).
 */
export class MonthlyPlan {
  readonly id: string;
  readonly month: YearMonth;
  readonly plannedIncome: Money;
  readonly savingsGoal: Money;
  readonly categoryBudgets: ReadonlyMap<KakeiboCategory, Money>;

  constructor(props: MonthlyPlanProps) {
    const currency = props.plannedIncome.currency;

    assertSameCurrency(currency, props.savingsGoal);
    for (const budget of props.categoryBudgets.values()) {
      assertSameCurrency(currency, budget);
    }

    if (props.savingsGoal.isNegative()) {
      throw new BusinessRuleError("Savings goal cannot be negative");
    }
    if (props.plannedIncome.isNegative()) {
      throw new BusinessRuleError("Planned income cannot be negative");
    }
    if (props.savingsGoal.compareTo(props.plannedIncome) > 0) {
      throw new BusinessRuleError("Savings goal cannot exceed planned income");
    }

    this.id = props.id;
    this.month = props.month;
    this.plannedIncome = props.plannedIncome;
    this.savingsGoal = props.savingsGoal;
    this.categoryBudgets = new Map(props.categoryBudgets);
    Object.freeze(this);
  }

  /** The plan's working currency (derived from planned income). */
  get currency(): string {
    return this.plannedIncome.currency;
  }

  /**
   * The kakeibo spending envelope: planned income minus the savings goal.
   * This is the total amount the household may spend across all categories.
   */
  availableToSpend(): Money {
    return this.plannedIncome.subtract(this.savingsGoal);
  }

  /** The budget ceiling for a category, or zero when none was set. */
  budgetFor(category: KakeiboCategory): Money {
    return this.categoryBudgets.get(category) ?? Money.zero(this.currency);
  }

  /** Sum of all per-category budget ceilings. */
  totalCategoryBudget(): Money {
    let total = Money.zero(this.currency);
    for (const category of ALL_CATEGORIES) {
      total = total.add(this.budgetFor(category));
    }
    return total;
  }
}

function assertSameCurrency(expected: string, money: Money): void {
  if (money.currency !== expected) {
    throw new CurrencyMismatchError(expected, money.currency);
  }
}
