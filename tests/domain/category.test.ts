import { describe, expect, test } from "bun:test";
import {
  ALL_CATEGORIES,
  isKakeiboCategory,
  KakeiboCategory,
  toKakeiboCategory,
} from "../../src/domain/category.ts";
import { InvalidValueError } from "../../src/domain/errors.ts";

describe("KakeiboCategory", () => {
  test("exposes the four kakeibo pillars in order", () => {
    expect(ALL_CATEGORIES).toEqual([
      KakeiboCategory.NEEDS,
      KakeiboCategory.WANTS,
      KakeiboCategory.CULTURE,
      KakeiboCategory.UNEXPECTED,
    ]);
  });

  test("isKakeiboCategory narrows known values", () => {
    expect(isKakeiboCategory("NEEDS")).toBe(true);
    expect(isKakeiboCategory("FOOD")).toBe(false);
  });

  test("toKakeiboCategory returns the value for valid input", () => {
    expect(toKakeiboCategory("WANTS")).toBe(KakeiboCategory.WANTS);
  });

  test("toKakeiboCategory throws for unknown input", () => {
    expect(() => toKakeiboCategory("FOOD")).toThrow(InvalidValueError);
  });
});
