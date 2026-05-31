import { describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { Money } from "../../src/domain/money.ts";
import { Transaction, TransactionType } from "../../src/domain/transaction.ts";
import {
  CsvImportError,
  csvToImportRecords,
  transactionsToCsv,
} from "../../src/interface/http/transaction-csv.ts";

describe("transactionsToCsv", () => {
  test("serialises transactions with a header row", () => {
    const csv = transactionsToCsv([
      new Transaction({
        id: "t1",
        type: TransactionType.EXPENSE,
        amount: Money.ofMinor(1500, "JPY"),
        category: KakeiboCategory.NEEDS,
        occurredAt: new Date("2026-05-10T00:00:00Z"),
        note: "Groceries",
      }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("date,type,category,amount,currency,note");
    expect(lines[1]).toBe("2026-05-10T00:00:00.000Z,EXPENSE,NEEDS,1500,JPY,Groceries");
  });
});

describe("csvToImportRecords", () => {
  test("parses rows by header name regardless of order", () => {
    const csv = ["type,amount,category,date,note", "EXPENSE,1500,NEEDS,2026-05-10,Groceries"].join(
      "\n",
    );
    const records = csvToImportRecords(csv, "JPY");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      type: "EXPENSE",
      amountMinor: 1500,
      currency: "JPY",
      category: KakeiboCategory.NEEDS,
      note: "Groceries",
    });
    expect(records[0]?.occurredAt?.toISOString().slice(0, 10)).toBe("2026-05-10");
  });

  test("converts major amounts using the currency precision", () => {
    const csv = "date,type,category,amount,currency,note\n2026-05-01,EXPENSE,WANTS,12.34,USD,";
    expect(csvToImportRecords(csv, "JPY")[0]?.amountMinor).toBe(1234);
  });

  test("income rows carry no category", () => {
    const csv = "date,type,category,amount\n2026-05-01,INCOME,,300000";
    expect(csvToImportRecords(csv, "JPY")[0]?.category).toBeUndefined();
  });

  test("throws on a missing required column", () => {
    expect(() => csvToImportRecords("type,category,note\nEXPENSE,NEEDS,x", "JPY")).toThrow(
      CsvImportError,
    );
  });

  test("throws with the row number on an invalid type", () => {
    const csv = "date,type,category,amount\n2026-05-01,BOGUS,NEEDS,100";
    expect(() => csvToImportRecords(csv, "JPY")).toThrow(/Row 2/);
  });

  test("throws on an invalid amount", () => {
    const csv = "date,type,category,amount\n2026-05-01,EXPENSE,NEEDS,abc";
    expect(() => csvToImportRecords(csv, "JPY")).toThrow(CsvImportError);
  });

  test("throws with the row number on an empty amount", () => {
    const csv = "date,type,category,amount\n2026-05-01,EXPENSE,NEEDS,";
    expect(() => csvToImportRecords(csv, "JPY")).toThrow(/Row 2/);
  });

  test.each(["0", "-100"])("rejects a non-positive amount %p at the CSV layer", (amount) => {
    const csv = `date,type,category,amount\n2026-05-01,EXPENSE,NEEDS,${amount}`;
    expect(() => csvToImportRecords(csv, "JPY")).toThrow(/Row 2/);
  });
});
