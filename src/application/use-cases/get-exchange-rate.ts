import { getCurrency } from "../../domain/currency.ts";
import { type ExchangeRateProvider } from "../ports/exchange-rate-provider.ts";

/**
 * The resolved rate offered to the client. `rate` is `null` when no rate could
 * be determined, signalling the UI to ask for a manual entry (the hybrid
 * policy from #28). `source` is `"identity"` for a same-currency pair, the
 * provider's source string when fetched, or `null` alongside a null rate.
 */
export interface ExchangeRateResult {
  readonly from: string;
  readonly to: string;
  readonly rate: number | null;
  readonly asOf: string | null;
  readonly source: string | null;
}

/**
 * Resolves the exchange rate from one currency to another, preferring an
 * automatic quote but degrading gracefully to a manual fallback.
 *
 * Same-currency pairs are answered locally (identity, rate 1) without touching
 * the provider. Unsupported currencies are rejected up front via the domain
 * currency registry.
 */
export class GetExchangeRate {
  constructor(private readonly provider: ExchangeRateProvider) {}

  async execute(from: string, to: string): Promise<ExchangeRateResult> {
    // Validate against the registry first (throws InvalidValueError -> HTTP 400).
    const fromCode = getCurrency(from).code;
    const toCode = getCurrency(to).code;

    if (fromCode === toCode) {
      return { from: fromCode, to: toCode, rate: 1, asOf: null, source: "identity" };
    }

    const quote = await this.provider.getLatestRate(fromCode, toCode);
    if (quote === null) {
      return { from: fromCode, to: toCode, rate: null, asOf: null, source: null };
    }
    return { from: fromCode, to: toCode, rate: quote.rate, asOf: quote.asOf, source: quote.source };
  }
}
