import { describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { BusinessRuleError, InvalidValueError } from "../../src/domain/errors.ts";
import { Money } from "../../src/domain/money.ts";
import { RecurringExpense } from "../../src/domain/recurring-expense.ts";
import { YearMonth } from "../../src/domain/year-month.ts";

function build(overrides: Partial<ConstructorParameters<typeof RecurringExpense>[0]> = {}) {
  return new RecurringExpense({
    id: "r1",
    name: "Rent",
    amount: Money.ofMinor(85000, "JPY"),
    category: KakeiboCategory.NEEDS,
    dayOfMonth: 1,
    active: true,
    ...overrides,
  });
}

describe("RecurringExpense", () => {
  test("creates a valid recurring expense and trims the name", () => {
    const r = build({ name: "  Netflix  " });
    expect(r.name).toBe("Netflix");
    expect(r.amount.amount).toBe(85000);
  });

  test("rejects an empty name", () => {
    expect(() => build({ name: "   " })).toThrow(BusinessRuleError);
  });

  test("baseAmount defaults to the original amount when omitted", () => {
    const r = build();
    expect(r.baseAmount.equals(r.amount)).toBe(true);
  });

  test("keeps a distinct base-currency amount when provided", () => {
    const r = build({
      amount: Money.ofMinor(1500, "USD"), // $15.00 subscription
      baseAmount: Money.ofMinor(2250, "JPY"), // ¥2,250 at booking rate
    });
    expect(r.amount.currency).toBe("USD");
    expect(r.baseAmount.currency).toBe("JPY");
    expect(r.baseAmount.amount).toBe(2250);
  });

  test("rejects a non-positive base amount", () => {
    expect(() => build({ baseAmount: Money.ofMinor(0, "JPY") })).toThrow(BusinessRuleError);
  });

  test("rejects a non-positive amount", () => {
    expect(() => build({ amount: Money.ofMinor(0, "JPY") })).toThrow(BusinessRuleError);
  });

  test.each([0, 29, 1.5, -3])("rejects an out-of-range dayOfMonth: %p", (day) => {
    expect(() => build({ dayOfMonth: day })).toThrow(InvalidValueError);
  });

  test("computes the scheduled UTC date within a month", () => {
    const date = build({ dayOfMonth: 15 }).scheduledDate(YearMonth.parse("2026-05"));
    expect(date.toISOString()).toBe("2026-05-15T00:00:00.000Z");
  });
});
