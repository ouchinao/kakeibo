import { describe, expect, test } from "bun:test";
import {
  DEFAULT_LANGUAGE,
  errorMessage,
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

describe("errorMessage", () => {
  test("localises a mapped error code in the active language", () => {
    expect(errorMessage("en", "VALIDATION_ERROR", "Validation failed")).toBe(
      "The information you entered is not valid.",
    );
    expect(errorMessage("ja", "VALIDATION_ERROR", "Validation failed")).toBe(
      "入力された内容が正しくありません。",
    );
  });

  test("localises a domain error code (e.g. BusinessRuleError)", () => {
    expect(errorMessage("ja", "BusinessRuleError", "some english detail")).not.toBe(
      "some english detail",
    );
    expect(errorMessage("ja", "BusinessRuleError", "some english detail").length).toBeGreaterThan(0);
  });

  test("falls back to the server-provided message for an unmapped code", () => {
    expect(errorMessage("en", "SOME_UNKNOWN_CODE", "Raw server message")).toBe(
      "Raw server message",
    );
    expect(errorMessage("ja", "SOME_UNKNOWN_CODE", "Raw server message")).toBe(
      "Raw server message",
    );
  });

  test("falls back to a generic message when both code and fallback are missing", () => {
    expect(errorMessage("en", undefined, undefined).length).toBeGreaterThan(0);
    expect(errorMessage("en", "", "").length).toBeGreaterThan(0);
    expect(errorMessage("ja", null, null).length).toBeGreaterThan(0);
  });

  test("never returns the raw i18n key", () => {
    // An unmapped code with no fallback must not leak the internal key form.
    expect(errorMessage("en", "NOPE", undefined)).not.toBe("error.NOPE");
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
