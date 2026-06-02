import { describe, expect, test } from "bun:test";
import { InvalidValueError } from "../../src/domain/errors.ts";
import { YearMonth } from "../../src/domain/year-month.ts";

describe("YearMonth", () => {
  test("parses a valid YYYY-MM string", () => {
    const ym = YearMonth.parse("2026-05");
    expect(ym.year).toBe(2026);
    expect(ym.month).toBe(5);
  });

  test("round-trips through toString", () => {
    expect(YearMonth.parse("2026-05").toString()).toBe("2026-05");
    expect(YearMonth.of(7, 3).toString()).toBe("0007-03");
  });

  test.each([
    ["2026-5", "missing zero padding"],
    ["2026/05", "wrong separator"],
    ["26-05", "short year"],
    ["", "empty"],
  ])("rejects malformed input %p (%s)", (value) => {
    expect(() => YearMonth.parse(value)).toThrow(InvalidValueError);
  });

  test("rejects out-of-range months", () => {
    expect(() => YearMonth.of(2026, 0)).toThrow(InvalidValueError);
    expect(() => YearMonth.of(2026, 13)).toThrow(InvalidValueError);
  });

  test("derives the month from a date in UTC", () => {
    const ym = YearMonth.fromDate(new Date("2026-05-30T23:00:00Z"));
    expect(ym.toString()).toBe("2026-05");
  });

  test("contains tells whether a date falls in the month", () => {
    const may = YearMonth.parse("2026-05");
    expect(may.contains(new Date("2026-05-01T00:00:00Z"))).toBe(true);
    expect(may.contains(new Date("2026-06-01T00:00:00Z"))).toBe(false);
  });

  test("equals is value based", () => {
    expect(YearMonth.of(2026, 5).equals(YearMonth.parse("2026-05"))).toBe(true);
    expect(YearMonth.of(2026, 5).equals(YearMonth.of(2026, 6))).toBe(false);
  });

  describe("minusMonths", () => {
    test("subtracts within the same year", () => {
      expect(YearMonth.parse("2026-05").minusMonths(3).toString()).toBe("2026-02");
    });

    test("rolls back across a year boundary", () => {
      expect(YearMonth.parse("2026-02").minusMonths(3).toString()).toBe("2025-11");
    });

    test("spans multiple years", () => {
      expect(YearMonth.parse("2026-05").minusMonths(17).toString()).toBe("2024-12");
    });

    test("a zero offset returns the same month", () => {
      expect(YearMonth.parse("2026-05").minusMonths(0).toString()).toBe("2026-05");
    });

    test("a negative offset moves forward in time", () => {
      expect(YearMonth.parse("2026-11").minusMonths(-3).toString()).toBe("2027-02");
    });
  });
});
