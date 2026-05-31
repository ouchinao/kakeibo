import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { Money } from "../../src/domain/money.ts";
import { RecurringExpense } from "../../src/domain/recurring-expense.ts";
import { YearMonth } from "../../src/domain/year-month.ts";
import { migrate } from "../../src/infrastructure/persistence/database.ts";
import {
  SqliteRecurringExpenseRepository,
  SqliteRecurringPostingLog,
} from "../../src/infrastructure/persistence/sqlite-recurring-repositories.ts";

let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  migrate(db);
});

afterEach(() => {
  db.close();
});

function rent(id = "r1"): RecurringExpense {
  return new RecurringExpense({
    id,
    name: "Rent",
    amount: Money.ofMinor(85000, "JPY"),
    category: KakeiboCategory.NEEDS,
    dayOfMonth: 1,
    active: true,
  });
}

describe("SqliteRecurringExpenseRepository", () => {
  test("round-trips a recurring expense", async () => {
    const repo = new SqliteRecurringExpenseRepository(db);
    await repo.save(rent());
    const loaded = await repo.findById("r1");
    expect(loaded?.name).toBe("Rent");
    expect(loaded?.amount.amount).toBe(85000);
    expect(loaded?.category).toBe(KakeiboCategory.NEEDS);
    expect(loaded?.active).toBe(true);
  });

  test("lists in insertion order", async () => {
    const repo = new SqliteRecurringExpenseRepository(db);
    await repo.save(rent("a"));
    await repo.save(rent("b"));
    expect((await repo.listAll()).map((r) => r.id)).toEqual(["a", "b"]);
  });

  test("delete reports whether a row was removed", async () => {
    const repo = new SqliteRecurringExpenseRepository(db);
    await repo.save(rent());
    expect(await repo.delete("r1")).toBe(true);
    expect(await repo.delete("r1")).toBe(false);
  });
});

describe("SqliteRecurringPostingLog", () => {
  const may = YearMonth.parse("2026-05");
  const june = YearMonth.parse("2026-06");

  test("records and reports posting state per month", async () => {
    const log = new SqliteRecurringPostingLog(db);
    expect(await log.isPosted("r1", may)).toBe(false);

    await log.markPosted("r1", may);
    expect(await log.isPosted("r1", may)).toBe(true);
    expect(await log.isPosted("r1", june)).toBe(false);
  });

  test("markPosted is idempotent", async () => {
    const log = new SqliteRecurringPostingLog(db);
    await log.markPosted("r1", may);
    await log.markPosted("r1", may);
    expect([...(await log.postedIds(may))]).toEqual(["r1"]);
  });

  test("postedIds returns the ids posted in a month", async () => {
    const log = new SqliteRecurringPostingLog(db);
    await log.markPosted("a", may);
    await log.markPosted("b", may);
    await log.markPosted("c", june);
    expect(await log.postedIds(may)).toEqual(new Set(["a", "b"]));
  });
});
