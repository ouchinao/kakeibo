import { beforeEach, describe, expect, test } from "bun:test";
import { KakeiboCategory } from "../../src/domain/category.ts";
import { BusinessRuleError } from "../../src/domain/errors.ts";
import { TransactionType } from "../../src/domain/transaction.ts";
import { ApplicationError, NotFoundError } from "../../src/application/errors.ts";
import { DeleteTransaction } from "../../src/application/use-cases/delete-transaction.ts";
import { ListTransactions } from "../../src/application/use-cases/list-transactions.ts";
import { RecordTransaction } from "../../src/application/use-cases/record-transaction.ts";
import { InMemoryTransactionRepository } from "../../src/infrastructure/persistence/in-memory-repositories.ts";
import { FixedClock, SequentialIdGenerator } from "../support/fakes.ts";

describe("transaction use cases", () => {
  let repo: InMemoryTransactionRepository;
  let clock: FixedClock;
  let record: RecordTransaction;
  let list: ListTransactions;
  let remove: DeleteTransaction;

  beforeEach(() => {
    repo = new InMemoryTransactionRepository();
    clock = new FixedClock(new Date("2026-05-15T09:00:00Z"));
    const ids = new SequentialIdGenerator();
    record = new RecordTransaction(repo, ids, clock, "JPY");
    list = new ListTransactions(repo);
    remove = new DeleteTransaction(repo);
  });

  test("records an expense and persists it", async () => {
    const tx = await record.execute({
      type: TransactionType.EXPENSE,
      amountMinor: 1500,
      currency: "JPY",
      category: KakeiboCategory.NEEDS,
      note: "Groceries",
    });

    expect(tx.id).toBe("id-1");
    expect(await repo.findById("id-1")).not.toBeNull();
    expect(tx.amount.format()).toBe("¥1,500");
  });

  test("defaults occurredAt to the clock's now", async () => {
    const tx = await record.execute({
      type: TransactionType.INCOME,
      amountMinor: 300000,
      currency: "JPY",
    });
    expect(tx.occurredAt.toISOString()).toBe("2026-05-15T09:00:00.000Z");
  });

  test("propagates domain invariant violations", async () => {
    await expect(
      record.execute({
        type: TransactionType.EXPENSE,
        amountMinor: 100,
        currency: "JPY",
        // missing category for an expense
      }),
    ).rejects.toThrow(BusinessRuleError);
  });

  test("requires an explicit rate for a foreign-currency transaction", async () => {
    await expect(
      record.execute({
        type: TransactionType.EXPENSE,
        amountMinor: 1234,
        currency: "USD", // base is JPY; no rate supplied
        category: KakeiboCategory.WANTS,
      }),
    ).rejects.toThrow(ApplicationError);
  });

  test("converts a foreign-currency transaction using the supplied rate", async () => {
    const tx = await record.execute({
      type: TransactionType.EXPENSE,
      amountMinor: 1234, // $12.34
      currency: "USD",
      category: KakeiboCategory.WANTS,
      rate: 150, // USD -> JPY
    });
    expect(tx.amount.currency).toBe("USD");
    expect(tx.baseAmount.currency).toBe("JPY");
    expect(tx.baseAmount.amount).toBe(1851); // round(12.34 * 150)
  });

  test("lists only the requested month, newest first", async () => {
    await record.execute({
      type: TransactionType.EXPENSE,
      amountMinor: 100,
      currency: "JPY",
      category: KakeiboCategory.WANTS,
      occurredAt: new Date("2026-05-01T00:00:00Z"),
    });
    await record.execute({
      type: TransactionType.EXPENSE,
      amountMinor: 200,
      currency: "JPY",
      category: KakeiboCategory.WANTS,
      occurredAt: new Date("2026-05-20T00:00:00Z"),
    });
    await record.execute({
      type: TransactionType.EXPENSE,
      amountMinor: 999,
      currency: "JPY",
      category: KakeiboCategory.WANTS,
      occurredAt: new Date("2026-06-02T00:00:00Z"),
    });

    const may = await list.execute("2026-05");
    expect(may.map((t) => t.amount.amount)).toEqual([200, 100]);
  });

  test("deletes an existing transaction", async () => {
    const tx = await record.execute({
      type: TransactionType.INCOME,
      amountMinor: 1000,
      currency: "JPY",
    });
    await remove.execute(tx.id);
    expect(await repo.findById(tx.id)).toBeNull();
  });

  test("deleting a missing transaction throws NotFoundError", async () => {
    await expect(remove.execute("does-not-exist")).rejects.toThrow(NotFoundError);
  });
});
