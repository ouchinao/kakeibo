import type { KakeiboCategory } from "./category.ts";
import { BusinessRuleError, InvalidValueError } from "./errors.ts";
import type { Money } from "./money.ts";

/** Whether money flows in (income) or out (expense). */
export const TransactionType = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export interface TransactionProps {
  readonly id: string;
  readonly type: TransactionType;
  readonly amount: Money;
  /** Required for expenses, must be absent for income. */
  readonly category?: KakeiboCategory | undefined;
  readonly occurredAt: Date;
  readonly note: string;
  /**
   * The amount converted to the app's base currency at booking time. Defaults
   * to `amount` (i.e. the transaction is already in the base currency / rate 1).
   * Aggregations sum this so mixed-currency months total correctly.
   */
  readonly baseAmount?: Money | undefined;
}

/**
 * A single money movement: either income received or an expense spent within a
 * kakeibo category.
 *
 * Invariants enforced here:
 *  - the amount must be strictly positive (direction is captured by `type`);
 *  - expenses must carry a category, income must not.
 */
export class Transaction {
  readonly id: string;
  readonly type: TransactionType;
  readonly amount: Money;
  readonly category: KakeiboCategory | undefined;
  readonly occurredAt: Date;
  readonly note: string;
  /** The amount expressed in the base currency (defaults to {@link amount}). */
  readonly baseAmount: Money;

  constructor(props: TransactionProps) {
    if (!props.amount.isPositive()) {
      throw new BusinessRuleError("Transaction amount must be strictly positive");
    }
    if (props.baseAmount !== undefined && !props.baseAmount.isPositive()) {
      throw new BusinessRuleError("Transaction base amount must be strictly positive");
    }
    if (props.type === TransactionType.EXPENSE && props.category === undefined) {
      throw new BusinessRuleError("An expense must be assigned to a kakeibo category");
    }
    if (props.type === TransactionType.INCOME && props.category !== undefined) {
      throw new BusinessRuleError("Income transactions must not carry a category");
    }
    if (Number.isNaN(props.occurredAt.getTime())) {
      throw new InvalidValueError("Transaction occurredAt must be a valid date");
    }

    this.id = props.id;
    this.type = props.type;
    this.amount = props.amount;
    this.category = props.category;
    this.occurredAt = props.occurredAt;
    this.note = props.note;
    this.baseAmount = props.baseAmount ?? props.amount;
    Object.freeze(this);
  }

  /** True when this transaction represents an expense. */
  isExpense(): boolean {
    return this.type === TransactionType.EXPENSE;
  }

  /** True when this transaction represents income. */
  isIncome(): boolean {
    return this.type === TransactionType.INCOME;
  }

  /**
   * The signed effect on a running balance: positive for income, negative for
   * expenses. Useful when folding a list of transactions into a net total.
   */
  signedAmount(): Money {
    return this.isIncome() ? this.amount : this.amount.multiply(-1);
  }

  /** Like {@link signedAmount} but in the base currency. */
  signedBaseAmount(): Money {
    return this.isIncome() ? this.baseAmount : this.baseAmount.multiply(-1);
  }
}
