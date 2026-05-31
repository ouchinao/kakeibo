import { InvalidValueError } from "./errors.ts";

/**
 * Metadata describing a supported ISO 4217 currency.
 *
 * `minorUnits` is the number of decimal places the currency uses (its
 * "exponent"). For example JPY has 0 (no sub-unit), while USD and EUR have 2.
 */
export interface CurrencyDefinition {
  readonly code: string;
  readonly minorUnits: number;
  readonly symbol: string;
}

/**
 * Registry of currencies the engine understands.
 *
 * Kept intentionally small and explicit: this is a privacy-first, offline app,
 * so we ship a curated set rather than depending on an external currency feed.
 */
const CURRENCIES: Readonly<Record<string, CurrencyDefinition>> = {
  JPY: { code: "JPY", minorUnits: 0, symbol: "¥" },
  USD: { code: "USD", minorUnits: 2, symbol: "$" },
  EUR: { code: "EUR", minorUnits: 2, symbol: "€" },
  AUD: { code: "AUD", minorUnits: 2, symbol: "A$" },
  THB: { code: "THB", minorUnits: 2, symbol: "฿" },
  MYR: { code: "MYR", minorUnits: 2, symbol: "RM" },
  TWD: { code: "TWD", minorUnits: 2, symbol: "NT$" },
  SGD: { code: "SGD", minorUnits: 2, symbol: "S$" },
};

/** Returns true when the given code is a supported currency. */
export function isSupportedCurrency(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}

/**
 * Resolves the definition for a currency code.
 *
 * @throws {InvalidValueError} when the code is not supported.
 */
export function getCurrency(code: string): CurrencyDefinition {
  const normalized = code.trim().toUpperCase();
  const definition = CURRENCIES[normalized];
  if (definition === undefined) {
    throw new InvalidValueError(
      `Unsupported currency code: "${code}". Supported: ${Object.keys(CURRENCIES).join(", ")}`,
    );
  }
  return definition;
}

/** All supported currencies, in registry order. */
export function listCurrencies(): CurrencyDefinition[] {
  return Object.values(CURRENCIES);
}
