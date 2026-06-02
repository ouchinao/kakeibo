import type {
  ExchangeRateProvider,
  ExchangeRateQuote,
} from "../../application/ports/exchange-rate-provider.ts";

/** The subset of the global `fetch` signature this adapter relies on. */
type FetchFn = typeof fetch;

/** Shape of the Frankfurter `/latest` response we depend on. */
interface FrankfurterLatest {
  readonly date?: string;
  readonly rates?: Record<string, number>;
}

/**
 * Fetches rates from Frankfurter (https://www.frankfurter.app) — a free,
 * key-less, ECB-backed FX API. No credentials are required, so nothing
 * sensitive is stored or sent. (The host must be reachable: in a locked-down
 * network policy, add `api.frankfurter.app` to the allowlist — otherwise the
 * call fails and the app falls back to a manually entered rate.)
 *
 * Per the {@link ExchangeRateProvider} contract this never throws: any failure
 * (HTTP error, malformed body, blocked network, or a currency outside the ECB
 * set such as TWD) resolves to `null`, letting the caller fall back to a
 * manually entered rate.
 *
 * `fetch` and the base URL are injectable so the adapter is fully testable
 * without hitting the network.
 */
export class FrankfurterRateProvider implements ExchangeRateProvider {
  constructor(
    private readonly fetchFn: FetchFn = fetch,
    private readonly baseUrl = "https://api.frankfurter.app",
  ) {}

  async getLatestRate(from: string, to: string): Promise<ExchangeRateQuote | null> {
    const url = `${this.baseUrl}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    try {
      const response = await this.fetchFn(url);
      if (!response.ok) return null;

      const data = (await response.json()) as FrankfurterLatest;
      const rate = data.rates?.[to];
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        return null;
      }
      return { from, to, rate, asOf: data.date ?? null, source: "frankfurter" };
    } catch {
      // Network blocked/offline or an unexpected error: degrade to manual entry.
      return null;
    }
  }
}
