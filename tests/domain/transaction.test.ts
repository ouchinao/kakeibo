import { describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { BusinessRuleError } from "../../src/domain/errors.ts";
import { Money } from "../../src/domain/money.ts";
import { Transaction, TransactionType } from "../../src/domain/transaction.ts";

const baseDate = new Date("2026-05-10T12:00:00Z");

describe("Transaction", () => {
  test("creates a valid expense with a category", () => {
    const tx = new Transaction({
      id: "t1",
      type: TransactionType.EXPENSE,
      amount: Money.ofMinor(1500, "JPY"),
      category: KakeiboCategory.NEEDS,
      occurredAt: baseDate,
      note: "Groceries",
    });
    expect(tx.isExpense()).toBe(true);
    expect(tx.category).toBe(KakeiboCategory.NEEDS);
  });

  test("creates a valid income without a category", () => {
    const tx = new Transaction({
      id: "t2",
      type: TransactionType.INCOME,
      amount: Money.ofMinor(300000, "JPY"),
      occurredAt: baseDate,
      note: "Salary",
    });
    expect(tx.isIncome()).toBe(true);
    expect(tx.category).toBeUndefined();
  });

  test("rejects a non-positive amount", () => {
    expect(
      () =>
        new Transaction({
          id: "t3",
          type: TransactionType.EXPENSE,
          amount: Money.ofMinor(0, "JPY"),
          category: KakeiboCategory.WANTS,
          occurredAt: baseDate,
          note: "",
        }),
    ).toThrow(BusinessRuleError);
  });

  test("rejects an expense without a category", () => {
    expect(
      () =>
        new Transaction({
          id: "t4",
          type: TransactionType.EXPENSE,
          amount: Money.ofMinor(100, "JPY"),
          occurredAt: baseDate,
          note: "",
        }),
    ).toThrow(BusinessRuleError);
  });

  test("rejects income that carries a category", () => {
    expect(
      () =>
        new Transaction({
          id: "t5",
          type: TransactionType.INCOME,
          amount: Money.ofMinor(100, "JPY"),
          category: KakeiboCategory.NEEDS,
          occurredAt: baseDate,
          note: "",
        }),
    ).toThrow(BusinessRuleError);
  });

  test("signedAmount is negative for expenses and positive for income", () => {
    const expense = new Transaction({
      id: "t6",
      type: TransactionType.EXPENSE,
      amount: Money.ofMinor(100, "JPY"),
      category: KakeiboCategory.WANTS,
      occurredAt: baseDate,
      note: "",
    });
    const income = new Transaction({
      id: "t7",
      type: TransactionType.INCOME,
      amount: Money.ofMinor(100, "JPY"),
      occurredAt: baseDate,
      note: "",
    });
    expect(expense.signedAmount().amount).toBe(-100);
    expect(income.signedAmount().amount).toBe(100);
  });

  test("baseAmount defaults to the original amount when omitted", () => {
    const tx = new Transaction({
      id: "t8",
      type: TransactionType.EXPENSE,
      amount: Money.ofMinor(1500, "JPY"),
      category: KakeiboCategory.NEEDS,
      occurredAt: baseDate,
      note: "",
    });
    expect(tx.baseAmount.equals(tx.amount)).toBe(true);
  });

  test("keeps a distinct base-currency amount when provided", () => {
    const tx = new Transaction({
      id: "t9",
      type: TransactionType.EXPENSE,
      amount: Money.ofMinor(1234, "USD"), // $12.34
      baseAmount: Money.ofMinor(1850, "JPY"), // ¥1,850 at booking rate
      category: KakeiboCategory.WANTS,
      occurredAt: baseDate,
      note: "",
    });
    expect(tx.amount.currency).toBe("USD");
    expect(tx.baseAmount.currency).toBe("JPY");
    expect(tx.baseAmount.amount).toBe(1850);
  });

  test("rejects a non-positive base amount", () => {
    expect(
      () =>
        new Transaction({
          id: "t10",
          type: TransactionType.INCOME,
          amount: Money.ofMinor(100, "USD"),
          baseAmount: Money.ofMinor(0, "JPY"),
          occurredAt: baseDate,
          note: "",
        }),
    ).toThrow(BusinessRuleError);
  });

  test("signedBaseAmount mirrors signedAmount in the base currency", () => {
    const tx = new Transaction({
      id: "t11",
      type: TransactionType.EXPENSE,
      amount: Money.ofMinor(1234, "USD"),
      baseAmount: Money.ofMinor(1850, "JPY"),
      category: KakeiboCategory.WANTS,
      occurredAt: baseDate,
      note: "",
    });
    expect(tx.signedBaseAmount().amount).toBe(-1850);
  });
});
