import { type KakeiboCategory } from "./category.ts";
import { BusinessRuleError, InvalidValueError } from "./errors.ts";
import { Money } from "./money.ts";
import { type YearMonth } from "./year-month.ts";

export interface RecurringExpenseProps {
  readonly id: string;
  readonly name: string;
  readonly amount: Money;
  readonly category: KakeiboCategory;
  /** Day of the month the charge falls on (1–28, to stay valid in every month). */
  readonly dayOfMonth: number;
  readonly active: boolean;
  /**
   * The amount converted to the app's base currency at creation time. Defaults
   * to `amount` (already base currency / rate 1). Forecasts and posted
   * transactions use this so mixed-currency projections total correctly.
   */
  readonly baseAmount?: Money | undefined;
}

/**
 * A fixed expense that repeats every month — rent, subscriptions, insurance.
 *
 * Modelling these explicitly lets the app both auto-post them as transactions
 * and project them into an end-of-month balance forecast, which is the
 * "automation" half of the hybrid kakeibo approach.
 *
 * Invariants:
 *  - the amount must be strictly positive;
 *  - `dayOfMonth` is constrained to 1–28 so it is valid in every month
 *    (including February), avoiding surprising rollovers.
 */
export class RecurringExpense {
  readonly id: string;
  readonly name: string;
  readonly amount: Money;
  readonly category: KakeiboCategory;
  readonly dayOfMonth: number;
  readonly active: boolean;
  /** The amount expressed in the base currency (defaults to {@link amount}). */
  readonly baseAmount: Money;

  constructor(props: RecurringExpenseProps) {
    if (props.name.trim().length === 0) {
      throw new BusinessRuleError("Recurring expense name must not be empty");
    }
    if (!props.amount.isPositive()) {
      throw new BusinessRuleError("Recurring expense amount must be strictly positive");
    }
    if (props.baseAmount !== undefined && !props.baseAmount.isPositive()) {
      throw new BusinessRuleError("Recurring expense base amount must be strictly positive");
    }
    if (!Number.isInteger(props.dayOfMonth) || props.dayOfMonth < 1 || props.dayOfMonth > 28) {
      throw new InvalidValueError("dayOfMonth must be an integer between 1 and 28");
    }

    this.id = props.id;
    this.name = props.name.trim();
    this.amount = props.amount;
    this.category = props.category;
    this.dayOfMonth = props.dayOfMonth;
    this.active = props.active;
    this.baseAmount = props.baseAmount ?? props.amount;
    Object.freeze(this);
  }

  /** The UTC date this expense is scheduled to occur within the given month. */
  scheduledDate(month: YearMonth): Date {
    return new Date(Date.UTC(month.year, month.month - 1, this.dayOfMonth));
  }
}
