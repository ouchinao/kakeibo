import { beforeEach, describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { BusinessRuleError } from "../../src/domain/errors.ts";
import { TransactionType } from "../../src/domain/transaction.ts";
import { YearMonth } from "../../src/domain/year-month.ts";
import { ImportTransactions } from "../../src/application/use-cases/import-transactions.ts";
import { InMemoryTransactionRepository } from "../../src/infrastructure/persistence/in-memory-repositories.ts";
import { FixedClock, SequentialIdGenerator } from "../support/fakes.ts";

describe("ImportTransactions", () => {
  let repo: InMemoryTransactionRepository;
  let importer: ImportTransactions;

  beforeEach(() => {
    repo = new InMemoryTransactionRepository();
    importer = new ImportTransactions(
      repo,
      new SequentialIdGenerator(),
      new FixedClock(new Date("2026-05-15T00:00:00Z")),
    );
  });

  test("imports a batch of valid records", async () => {
    const result = await importer.execute([
      {
        type: TransactionType.INCOME,
        amountMinor: 300000,
        currency: "JPY",
        occurredAt: new Date("2026-05-01T00:00:00Z"),
      },
      {
        type: TransactionType.EXPENSE,
        amountMinor: 1500,
        currency: "JPY",
        category: KakeiboCategory.NEEDS,
        occurredAt: new Date("2026-05-10T00:00:00Z"),
      },
    ]);

    expect(result.imported).toBe(2);
    expect(await repo.findByMonth(YearMonth.parse("2026-05"))).toHaveLength(2);
  });

  test("is atomic: an invalid record aborts the whole import", async () => {
    await expect(
      importer.execute([
        {
          type: TransactionType.EXPENSE,
          amountMinor: 1000,
          currency: "JPY",
          category: KakeiboCategory.NEEDS,
        },
        // invalid: an expense without a category violates a domain invariant
        { type: TransactionType.EXPENSE, amountMinor: 500, currency: "JPY" },
      ]),
    ).rejects.toThrow(BusinessRuleError);

    expect(await repo.findByMonth(YearMonth.parse("2026-05"))).toHaveLength(0);
  });

  test("defaults occurredAt to the clock when omitted", async () => {
    const result = await importer.execute([
      { type: TransactionType.INCOME, amountMinor: 1000, currency: "JPY" },
    ]);
    expect(result.transactions[0]?.occurredAt.toISOString()).toBe("2026-05-15T00:00:00.000Z");
  });
});
