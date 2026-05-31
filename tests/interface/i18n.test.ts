import { describe, expect, test } from "bun:test";
import {
  DEFAULT_LANGUAGE,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  translate,
  translations,
} from "../../src/interface/web/i18n.js";

describe("translate", () => {
  test("returns the translation for the requested language", () => {
    expect(translate("en", "button.add")).toBe("Add");
    expect(translate("ja", "button.add")).toBe("追加");
  });

  test("interpolates placeholders", () => {
    expect(translate("en", "msg.noBudget", { spent: "¥1,200" })).toBe(
      "¥1,200 spent · no budget set",
    );
    expect(translate("ja", "msg.budgetUsage", { spent: "¥100", budget: "¥200", pct: 50 })).toBe(
      "¥100 / ¥200（50%）",
    );
  });

  test("leaves unknown placeholders untouched", () => {
    expect(translate("en", "msg.noBudget", {})).toBe("{spent} spent · no budget set");
  });

  test("falls back to English for an unsupported language", () => {
    expect(translate("fr", "button.add")).toBe("Add");
  });

  test("falls back to the raw key when no translation exists", () => {
    expect(translate("en", "totally.missing.key")).toBe("totally.missing.key");
  });
});

describe("resolveLanguage", () => {
  test.each([
    ["ja", "ja"],
    ["ja-JP", "ja"],
    ["en-US", "en"],
    ["fr", "en"],
    ["", "en"],
  ])("resolves %p to %p", (input, expected) => {
    expect(resolveLanguage(input)).toBe(expected);
  });

  test("handles non-string input", () => {
    // @ts-expect-error intentionally passing a non-string
    expect(resolveLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
  });
});

describe("translation completeness", () => {
  test("every language defines the same set of keys", () => {
    const reference = Object.keys(translations[DEFAULT_LANGUAGE] ?? {}).sort();
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(Object.keys(translations[lang] ?? {}).sort()).toEqual(reference);
    }
  });

  test("no translation value is empty", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const [key, value] of Object.entries(translations[lang] ?? {})) {
        expect(value.length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});
