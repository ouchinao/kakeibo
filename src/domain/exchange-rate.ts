import { getCurrency } from "./currency.ts";
import { CurrencyMismatchError, InvalidValueError } from "./errors.ts";
import { Money } from "./money.ts";

/**
 * Immutable exchange rate between two currencies.
 *
 * `rate` is how many units of `to` one unit of `from` buys (e.g. USD→JPY 150
 * means $1 = ¥150). Conversion rounds to the target currency's precision, so
 * the result is always a valid {@link Money} regardless of how many decimals
 * the multiplication produced.
 */
export class ExchangeRate {
  private constructor(
    public readonly from: string,
    public readonly to: string,
    public readonly rate: number,
  ) {
    Object.freeze(this);
  }

  /**
   * Builds a rate between two supported currencies.
   *
   * @throws {InvalidValueError} for an unsupported currency or a
   *   non-positive / non-finite rate.
   */
  static of(from: string, to: string, rate: number): ExchangeRate {
    const fromDef = getCurrency(from);
    const toDef = getCurrency(to);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new InvalidValueError(`Exchange rate must be a positive finite number, received: ${rate}`);
    }
    return new ExchangeRate(fromDef.code, toDef.code, rate);
  }

  /** A 1:1 rate within a single currency (no conversion). */
  static identity(currency: string): ExchangeRate {
    return ExchangeRate.of(currency, currency, 1);
  }

  /**
   * Converts an amount in the `from` currency to the `to` currency, rounding
   * to the target's minor-unit precision.
   *
   * @throws {CurrencyMismatchError} when `money` is not in the `from` currency.
   */
  convert(money: Money): Money {
    if (money.currency !== this.from) {
      throw new CurrencyMismatchError(this.from, money.currency);
    }
    if (this.from === this.to) return money;

    const { minorUnits } = getCurrency(this.to);
    const targetMinor = Math.round(money.toMajor() * this.rate * 10 ** minorUnits);
    return Money.ofMinor(targetMinor, this.to);
  }
}
