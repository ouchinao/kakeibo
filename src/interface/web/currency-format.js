// Small pure helpers for currency-aware number inputs (browser-served).

/**
 * The HTML `<input type="number">` `step` for a currency with `minorUnits`
 * decimal places: "1" for zero-decimal currencies (e.g. JPY), "0.01" for two
 * (e.g. USD/EUR).
 */
export function amountStep(minorUnits) {
  return minorUnits <= 0 ? "1" : (1 / 10 ** minorUnits).toString();
}
