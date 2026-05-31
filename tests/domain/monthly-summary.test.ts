import { describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { Money } from "../../src/domain/money.ts";
import { buildMonthlySummary } from "../../src/domain/monthly-summary.ts";
import { Transaction, TransactionType } from "../../src/domain/transaction.ts";
import { YearMonth } from "../../src/domain/year-month.ts";

const month = YearMonth.parse("2026-05");

function expense(id: string, amount: number, currency: string): Transaction {
  return new Transaction({
    id,
    type: TransactionType.EXPENSE,
    amount: Money.ofMinor(amount, currency),
    category: KakeiboCategory.NEEDS,
    occurredAt: new Date("2026-05-10T00:00:00Z"),
    note: "",
  });
}

describe("buildMonthlySummary currency handling", () => {
  test("ignores transactions in a different currency instead of throwing", () => {
    const summary = buildMonthlySummary({
      month,
      currency: "JPY",
      plan: null,
      transactions: [expense("a", 1500, "JPY"), expense("b", 1000, "USD")],
    });

    // The USD expense is excluded from the single-currency view; no crash.
    expect(summary.currency).toBe("JPY");
    expect(summary.totalExpense.amount).toBe(1500);
    const needs = summary.categories.find((c) => c.category === KakeiboCategory.NEEDS);
    expect(needs?.spent.amount).toBe(1500);
  });
});
