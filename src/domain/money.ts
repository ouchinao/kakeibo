import { getCurrency } from "./currency.ts";
import { CurrencyMismatchError, InvalidValueError } from "./errors.ts";

/**
 * Immutable monetary value object.
 *
 * The amount is stored as an integer number of *minor units* (e.g. cents for
 * USD, whole yen for JPY) to avoid floating-point rounding errors that plague
 * money handling. All arithmetic is exact integer arithmetic.
 */
export class Money {
  private constructor(
    /** Amount in the currency's minor units (always an integer). */
    public readonly amount: number,
    /** ISO 4217 currency code (e.g. "JPY", "USD"). */
    public readonly currency: string,
  ) {
    Object.freeze(this);
  }

  /**
   * Creates a Money from a raw minor-unit amount.
   *
   * @throws {InvalidValueError} when the amount is not a safe integer or the
   *   currency is unsupported.
   */
  static ofMinor(amount: number, currency: string): Money {
    const definition = getCurrency(currency);
    if (!Number.isSafeInteger(amount)) {
      throw new InvalidValueError(`Money amount must be a safe integer, received: ${amount}`);
    }
    return new Money(amount, definition.code);
  }

  /**
   * Creates a Money from a major-unit amount (e.g. 12.34 USD -> 1234 cents).
   *
   * The major amount is rounded to the currency's precision using banker-free
   * arithmetic; supplying more precision than the currency allows is rejected
   * to keep input intent explicit.
   *
   * @throws {InvalidValueError} when the value is not finite or carries more
   *   precision than the currency supports.
   */
  static ofMajor(major: number, currency: string): Money {
    const definition = getCurrency(currency);
    if (!Number.isFinite(major)) {
      throw new InvalidValueError(`Money amount must be finite, received: ${major}`);
    }
    const factor = 10 ** definition.minorUnits;
    const scaled = major * factor;
    const rounded = Math.round(scaled);
    if (Math.abs(scaled - rounded) > 1e-6) {
      throw new InvalidValueError(
        `Amount ${major} has more precision than ${definition.code} supports (${definition.minorUnits} decimals)`,
      );
    }
    return Money.ofMinor(rounded, definition.code);
  }

  /** A zero amount in the given currency. */
  static zero(currency: string): Money {
    return Money.ofMinor(0, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  /** Returns the sum of this and another amount of the same currency. */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.ofMinor(this.amount + other.amount, this.currency);
  }

  /** Returns the difference of this and another amount of the same currency. */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.ofMinor(this.amount - other.amount, this.currency);
  }

  /** Returns this amount scaled by an integer or fractional factor (rounded). */
  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new InvalidValueError(`Multiplier must be finite, received: ${factor}`);
    }
    return Money.ofMinor(Math.round(this.amount * factor), this.currency);
  }

  /** True when the amount is exactly zero. */
  isZero(): boolean {
    return this.amount === 0;
  }

  /** True when the amount is below zero. */
  isNegative(): boolean {
    return this.amount < 0;
  }

  /** True when the amount is above zero. */
  isPositive(): boolean {
    return this.amount > 0;
  }

  /**
   * Compares two amounts of the same currency.
   *
   * @returns a negative number when this < other, zero when equal, positive
   *   when this > other.
   */
  compareTo(other: Money): number {
    this.assertSameCurrency(other);
    return this.amount - other.amount;
  }

  /** Value-based equality (same amount and currency). */
  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  /** The amount expressed in major units (e.g. 1234 cents -> 12.34). */
  toMajor(): number {
    const { minorUnits } = getCurrency(this.currency);
    return this.amount / 10 ** minorUnits;
  }

  /** Human-readable representation, e.g. "¥1,200" or "$12.34". */
  format(): string {
    const definition = getCurrency(this.currency);
    const major = this.toMajor();
    const formatted = major.toLocaleString("en-US", {
      minimumFractionDigits: definition.minorUnits,
      maximumFractionDigits: definition.minorUnits,
    });
    return `${definition.symbol}${formatted}`;
  }
}
