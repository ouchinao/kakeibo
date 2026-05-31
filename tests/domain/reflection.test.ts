import { describe, expect, test } from "bun:test";
import { Reflection } from "../../src/domain/reflection.ts";
import { YearMonth } from "../../src/domain/year-month.ts";

const month = YearMonth.parse("2026-05");

describe("Reflection", () => {
  test("stores trimmed answers", () => {
    const reflection = new Reflection({
      id: "r1",
      month,
      answers: new Map([["howToImprove", "  Cook at home more  "]]),
    });
    expect(reflection.answerFor("howToImprove")).toBe("Cook at home more");
  });

  test("drops empty or whitespace-only answers", () => {
    const reflection = new Reflection({
      id: "r2",
      month,
      answers: new Map([
        ["howMuchSaved", "   "],
        ["howToImprove", "Spend less on wants"],
      ]),
    });
    expect(reflection.answerFor("howMuchSaved")).toBeUndefined();
    expect(reflection.answers.size).toBe(1);
  });

  test("hasContent reflects whether any answer survived", () => {
    expect(new Reflection({ id: "r3", month, answers: new Map() }).hasContent()).toBe(false);
    expect(
      new Reflection({
        id: "r4",
        month,
        answers: new Map([["howMuchSpent", "About ¥240,000"]]),
      }).hasContent(),
    ).toBe(true);
  });
});
