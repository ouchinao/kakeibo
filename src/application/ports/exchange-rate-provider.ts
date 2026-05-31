/**
 * A single foreign-exchange quote: how many units of `to` one unit of `from`
 * buys, as of the provider's `asOf` date.
 */
export interface ExchangeRateQuote {
  readonly from: string;
  readonly to: string;
  /** Units of `to` per one unit of `from` (positive, finite). */
  readonly rate: number;
  /** The provider's reference date (ISO `YYYY-MM-DD`), if known. */
  readonly asOf: string | null;
  /** Identifies where the rate came from (e.g. "frankfurter"). */
  readonly source: string;
}

/**
 * Abstraction over an external exchange-rate source.
 *
 * Implementations must never throw for an unavailable or unsupported rate:
 * they return `null` so the application can fall back to a manually entered
 * rate (the app's hybrid policy). This keeps the network dependency optional
 * and the inner layers deterministic and testable.
 */
export interface ExchangeRateProvider {
  /**
   * Fetches the latest rate from `from` to `to`, or `null` when it cannot be
   * determined (unsupported currency, network failure, malformed response…).
   */
  getLatestRate(from: string, to: string): Promise<ExchangeRateQuote | null>;
}
