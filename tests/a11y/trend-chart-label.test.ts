import { describe, expect, test } from "bun:test";
import { trendChartAriaLabel } from "../../src/interface/web/a11y-labels.js";

const t = (key: string): string =>
  ({ "trend.savings": "savings", "type.income": "income", "type.expense": "expense" })[key] ?? key;

describe("trend chart text alternative", () => {
  test("summarises each month's figures for screen readers", () => {
    const label = trendChartAriaLabel(
      [
        {
          month: "2026-05",
          totalIncome: { formatted: "¥300,000" },
          totalExpense: { formatted: "¥190,000" },
          actualSavings: { formatted: "¥110,000" },
        },
      ],
      t,
    );
    expect(label).toContain("2026-05");
    expect(label).toContain("¥300,000");
    expect(label).toContain("¥190,000");
    expect(label).toContain("¥110,000");
  });

  test("handles an empty series", () => {
    expect(trendChartAriaLabel([], t)).toBeTypeOf("string");
  });
});
