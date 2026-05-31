import { InvalidValueError } from "./errors.ts";

const PATTERN = /^(\d{4})-(\d{2})$/;

/**
 * Immutable value object representing a calendar month (year + month).
 *
 * Kakeibo budgeting is organised month by month, so a first-class `YearMonth`
 * keeps that concept explicit and prevents malformed period strings from
 * leaking through the system.
 */
export class YearMonth {
  private constructor(
    public readonly year: number,
    /** 1-based month (1 = January, 12 = December). */
    public readonly month: number,
  ) {
    Object.freeze(this);
  }

  /**
   * Parses an ISO-like "YYYY-MM" string.
   *
   * @throws {InvalidValueError} when the string is malformed or out of range.
   */
  static parse(value: string): YearMonth {
    const match = PATTERN.exec(value);
    if (match === null) {
      throw new InvalidValueError(`Invalid year-month, expected "YYYY-MM", received: "${value}"`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    return YearMonth.of(year, month);
  }

  /**
   * Builds a YearMonth from numeric parts.
   *
   * @throws {InvalidValueError} when the month is outside 1..12.
   */
  static of(year: number, month: number): YearMonth {
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      throw new InvalidValueError(`Year and month must be integers, received: ${year}-${month}`);
    }
    if (month < 1 || month > 12) {
      throw new InvalidValueError(`Month must be between 1 and 12, received: ${month}`);
    }
    return new YearMonth(year, month);
  }

  /** Returns the YearMonth that a given Date falls into (in UTC). */
  static fromDate(date: Date): YearMonth {
    return YearMonth.of(date.getUTCFullYear(), date.getUTCMonth() + 1);
  }

  /** Canonical "YYYY-MM" string form. */
  toString(): string {
    return `${this.year.toString().padStart(4, "0")}-${this.month.toString().padStart(2, "0")}`;
  }

  /** Value-based equality. */
  equals(other: YearMonth): boolean {
    return this.year === other.year && this.month === other.month;
  }

  /** True when a Date falls inside this month (compared in UTC). */
  contains(date: Date): boolean {
    return date.getUTCFullYear() === this.year && date.getUTCMonth() + 1 === this.month;
  }

  /**
   * Returns the month `count` months before this one (handling year rollover).
   * A negative `count` moves forward in time.
   */
  minusMonths(count: number): YearMonth {
    if (!Number.isInteger(count)) {
      throw new InvalidValueError(`Month offset must be an integer, received: ${count}`);
    }
    // Convert to a zero-based absolute month index, shift, then convert back.
    const zeroBased = this.year * 12 + (this.month - 1) - count;
    return YearMonth.of(Math.floor(zeroBased / 12), (zeroBased % 12) + 1);
  }
}
