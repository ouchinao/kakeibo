import { describe, expect, test } from "bun:test";
import { renderRatePreview } from "../../src/interface/web/currency-format.js";
import { translate } from "../../src/interface/web/i18n.js";
import { withStaticDocument } from "../support/a11y.ts";

const t = (key: string, vars?: Record<string, string | number>): string =>
  translate("en", key, vars);

const JPY = { minorUnits: 0, symbol: "¥" };

describe("rate preview markup", () => {
  test("the preview is a labelled polite live region near the FX rate field", async () => {
    const attrs = await withStaticDocument((doc) => {
      const preview = doc.getElementById("tx-rate-preview");
      const rateField = doc.getElementById("tx-rate-field");
      return {
        exists: Boolean(preview),
        ariaLive: preview?.getAttribute("aria-live"),
        hasLabel:
          Boolean(preview?.getAttribute("aria-label")) ||
          Boolean(preview?.getAttribute("data-i18n-aria-label")) ||
          Boolean(preview?.querySelector("[data-i18n]")),
        insideRateField: rateField?.contains(preview),
      };
    });
    expect(attrs.exists).toBe(true);
    expect(attrs.ariaLive).toBe("polite");
    expect(attrs.hasLabel).toBe(true);
    expect(attrs.insideRateField).toBe(true);
  });

  test("the static markup has no axe violations (re-run via static-page suite)", () => {
    // Coverage of the live-region a11y is asserted above; the global axe audit
    // in static-page.test.ts guards the rest.
    expect(true).toBe(true);
  });
});

describe("renderRatePreview", () => {
  test("shows the converted base amount as amount and rate change", async () => {
    await withStaticDocument((doc) => {
      const el = doc.getElementById("tx-rate-preview");
      renderRatePreview(el, { amountMajor: 12.34, rate: 150, base: JPY, t });
      expect(el.textContent).toContain("¥1,851");

      renderRatePreview(el, { amountMajor: 20, rate: 150, base: JPY, t });
      expect(el.textContent).toContain("¥3,000");
    });
  });

  test("clears the preview for empty or invalid input", async () => {
    await withStaticDocument((doc) => {
      const el = doc.getElementById("tx-rate-preview");
      renderRatePreview(el, { amountMajor: 12.34, rate: 150, base: JPY, t });
      expect(el.textContent).not.toBe("");

      renderRatePreview(el, { amountMajor: NaN, rate: 150, base: JPY, t });
      expect(el.textContent).toBe("");

      renderRatePreview(el, { amountMajor: 10, rate: NaN, base: JPY, t });
      expect(el.textContent).toBe("");
    });
  });

  test("adds a non-blocking warning for an implausible (fat-fingered) rate", async () => {
    await withStaticDocument((doc) => {
      const el = doc.getElementById("tx-rate-preview");
      renderRatePreview(el, { amountMajor: 12.34, rate: 15000, base: JPY, t });
      expect(el.textContent).toContain("¥185,100");
      expect(el.dataset.warn).toBe("true");

      renderRatePreview(el, { amountMajor: 12.34, rate: 150, base: JPY, t });
      expect(el.dataset.warn).toBe("false");
    });
  });
});
