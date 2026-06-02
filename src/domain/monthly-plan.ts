import { ALL_CATEGORIES, type KakeiboCategory } from "./category.ts";
import { BusinessRuleError, CurrencyMismatchError } from "./errors.ts";
import { Money } from "./money.ts";
import type { YearMonth } from "./year-month.ts";

export interface MonthlyPlanProps {
  readonly id: string;
  readonly month: YearMonth;
  /** Income the household expects to receive this month. */
  readonly plannedIncome: Money;
  /** The amount the household commits to save first ("pay yourself first"). */
  readonly savingsGoal: Money;
  /** Optional spending ceiling per kakeibo category. */
  readonly categoryBudgets: ReadonlyMap<KakeiboCategory, Money>;
  /**
   * The plan's monetary fields converted to the app's base currency at save
   * time. Each defaults to its own-currency counterpart (the plan is already in
   * the base currency / rate 1). Aggregations use these so a plan denominated in
   * any currency still applies to the base-currency summary.
   */
  readonly basePlannedIncome?: Money | undefined;
  readonly baseSavingsGoal?: Money | undefined;
  readonly baseCategoryBudgets?: ReadonlyMap<KakeiboCategory, Money> | undefined;
}

/**
 * The monthly kakeibo plan, created at the start of a month.
 *
 * The signature kakeibo question is: "How much do I have, how much do I want
 * to save, and therefore how much can I spend?" This entity models exactly
 * that, and exposes `availableToSpend()` as the derived budget envelope.
 *
 * Invariants:
 *  - every monetary field must share the plan's currency (and, separately, the
 *    base-currency fields must share the base currency);
 *  - savings goal cannot exceed planned income (you cannot save more than you
 *    plan to earn).
 */
export class MonthlyPlan {
  readonly id: string;
  readonly month: YearMonth;
  readonly plannedIncome: Money;
  readonly savingsGoal: Money;
  readonly categoryBudgets: ReadonlyMap<KakeiboCategory, Money>;
  /** Base-currency view of the plan's fields (defaults to the own-currency ones). */
  readonly basePlannedIncome: Money;
  readonly baseSavingsGoal: Money;
  readonly baseCategoryBudgets: ReadonlyMap<KakeiboCategory, Money>;

  constructor(props: MonthlyPlanProps) {
    assertConsistent(props.plannedIncome, props.savingsGoal, props.categoryBudgets);

    const basePlannedIncome = props.basePlannedIncome ?? props.plannedIncome;
    const baseSavingsGoal = props.baseSavingsGoal ?? props.savingsGoal;
    const baseCategoryBudgets = props.baseCategoryBudgets ?? props.categoryBudgets;
    assertConsistent(basePlannedIncome, baseSavingsGoal, baseCategoryBudgets);

    this.id = props.id;
    this.month = props.month;
    this.plannedIncome = props.plannedIncome;
    this.savingsGoal = props.savingsGoal;
    this.categoryBudgets = new Map(props.categoryBudgets);
    this.basePlannedIncome = basePlannedIncome;
    this.baseSavingsGoal = baseSavingsGoal;
    this.baseCategoryBudgets = new Map(baseCategoryBudgets);
    Object.freeze(this);
  }

  /** The plan's working currency (derived from planned income). */
  get currency(): string {
    return this.plannedIncome.currency;
  }

  /** The app base currency this plan aggregates into (derived from base income). */
  get baseCurrency(): string {
    return this.basePlannedIncome.currency;
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

  /** {@link availableToSpend} expressed in the base currency. */
  baseAvailableToSpend(): Money {
    return this.basePlannedIncome.subtract(this.baseSavingsGoal);
  }

  /** {@link budgetFor} expressed in the base currency. */
  baseBudgetFor(category: KakeiboCategory): Money {
    return this.baseCategoryBudgets.get(category) ?? Money.zero(this.baseCurrency);
  }
}

/**
 * Validates that a (income, savings, budgets) triple shares one currency and
 * satisfies the plan's business rules. Applied to both the own-currency and the
 * base-currency views.
 */
function assertConsistent(
  plannedIncome: Money,
  savingsGoal: Money,
  categoryBudgets: ReadonlyMap<KakeiboCategory, Money>,
): void {
  const currency = plannedIncome.currency;
  assertSameCurrency(currency, savingsGoal);
  for (const budget of categoryBudgets.values()) {
    assertSameCurrency(currency, budget);
  }
  if (savingsGoal.isNegative()) {
    throw new BusinessRuleError("Savings goal cannot be negative");
  }
  if (plannedIncome.isNegative()) {
    throw new BusinessRuleError("Planned income cannot be negative");
  }
  if (savingsGoal.compareTo(plannedIncome) > 0) {
    throw new BusinessRuleError("Savings goal cannot exceed planned income");
  }
}

function assertSameCurrency(expected: string, money: Money): void {
  if (money.currency !== expected) {
    throw new CurrencyMismatchError(expected, money.currency);
  }
}
