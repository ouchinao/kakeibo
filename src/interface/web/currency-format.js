// Small pure helpers for currency-aware number inputs (browser-served).

/**
 * The HTML `<input type="number">` `step` for a currency with `minorUnits`
 * decimal places: "1" for zero-decimal currencies (e.g. JPY), "0.01" for two
 * (e.g. USD/EUR).
 */
export function amountStep(minorUnits) {
  return minorUnits <= 0 ? "1" : (1 / 10 ** minorUnits).toString();
}

/**
 * Converts a foreign major amount into the base currency's minor units using a
 * manual exchange rate: round(amount_major * rate) into `baseMinorUnits`.
 *
 * Returns `null` when the inputs are not a usable positive conversion (empty,
 * non-finite, zero, or negative), so callers can clear the preview instead of
 * showing a misleading value.
 */
export function convertToBaseMinor(amountMajor, rate, baseMinorUnits) {
  if (!Number.isFinite(amountMajor) || !Number.isFinite(rate)) return null;
  if (amountMajor <= 0 || rate <= 0) return null;
  const baseMajor = amountMajor * rate;
  return Math.round(baseMajor * 10 ** baseMinorUnits);
}

/**
 * Formats an amount given in minor units using a currency's symbol and
 * precision, mirroring the server-side Money.format() output (e.g. "¥1,851",
 * "$12.35") so the preview matches the rest of the UI.
 */
export function formatMoney(minor, { minorUnits, symbol }) {
  const major = minor / 10 ** minorUnits;
  const formatted = major.toLocaleString("en-US", {
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  });
  return `${symbol}${formatted}`;
}

// A genuine FX rate's magnitude stays within this window; anything outside is
// almost certainly a typo (e.g. 15000 entered for 150). We have no reference
// rate client-side, so this order-of-magnitude window is the only honest,
// currency-agnostic sanity check — and it comfortably admits JPY-scale rates.
const MIN_PLAUSIBLE_RATE = 1 / 1000;
const MAX_PLAUSIBLE_RATE = 1000;

/** True when `rate` is a plausibly-typed exchange rate (non-blocking heuristic). */
export function ratePlausible(rate) {
  if (!Number.isFinite(rate) || rate <= 0) return false;
  return rate >= MIN_PLAUSIBLE_RATE && rate <= MAX_PLAUSIBLE_RATE;
}

/**
 * Renders the live "≈ <base amount>" preview into `el` for a foreign-currency
 * entry. Clears the element for empty/invalid input, and sets
 * `el.dataset.warn` to "true" when the rate looks implausible so the UI can
 * surface a subtle, non-blocking warning.
 *
 * @param el        the aria-live preview element to update
 * @param amountMajor the entered amount in major units
 * @param rate      the manual rate to the base currency
 * @param base      the base currency `{ minorUnits, symbol }`
 * @param t         translator (key, vars) -> string
 */
export function renderRatePreview(el, { amountMajor, rate, base, t }) {
  if (!el) return;
  const baseMinor = convertToBaseMinor(amountMajor, rate, base.minorUnits);
  if (baseMinor === null) {
    el.textContent = "";
    el.dataset.warn = "false";
    return;
  }
  const converted = t("preview.convertedBase", { amount: formatMoney(baseMinor, base) });
  const plausible = ratePlausible(rate);
  el.dataset.warn = plausible ? "false" : "true";
  // Append the warning sentence so screen readers announce it (the colour cue
  // alone would not be conveyed); kept on the same polite region to stay subtle.
  el.textContent = plausible ? converted : `${converted} — ${t("preview.rateWarning")}`;
}
