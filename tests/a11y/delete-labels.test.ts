import { describe, expect, test } from "bun:test";
import {
  deleteRecurringAriaLabel,
  deleteTransactionAriaLabel,
} from "../../src/interface/web/a11y-labels.js";

const t = (key: string): string => (key === "button.delete" ? "Delete" : key);

describe("delete button accessible names", () => {
  test("transaction label is descriptive and distinguishes rows", () => {
    const a = deleteTransactionAriaLabel(
      { occurredAt: "2026-05-10T00:00:00Z", amount: { formatted: "¥1,500" }, note: "Groceries" },
      t,
    );
    const b = deleteTransactionAriaLabel(
      { occurredAt: "2026-05-11T00:00:00Z", amount: { formatted: "¥800" }, note: "" },
      t,
    );

    expect(a).toContain("Delete");
    expect(a).toContain("2026-05-10");
    expect(a).toContain("¥1,500");
    expect(a).toContain("Groceries");
    expect(a).not.toBe(b); // each row's button is uniquely identifiable
  });

  test("recurring label includes the expense name", () => {
    const label = deleteRecurringAriaLabel({ name: "Rent", amount: { formatted: "¥85,000" } }, t);
    expect(label).toContain("Delete");
    expect(label).toContain("Rent");
  });
});
