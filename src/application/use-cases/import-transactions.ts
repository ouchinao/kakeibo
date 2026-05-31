import { type KakeiboCategory } from "../../domain/category.ts";
import { Money } from "../../domain/money.ts";
import { Transaction, type TransactionType } from "../../domain/transaction.ts";
import { type Clock } from "../ports/clock.ts";
import { type IdGenerator } from "../ports/id-generator.ts";
import { type TransactionRepository } from "../ports/repositories.ts";

/** A single transaction to import (amounts already in minor units). */
export interface ImportTransactionRecord {
  readonly type: TransactionType;
  readonly amountMinor: number;
  readonly currency: string;
  readonly category?: KakeiboCategory | undefined;
  readonly occurredAt?: Date | undefined;
  readonly note?: string | undefined;
}

export interface ImportResult {
  readonly imported: number;
  readonly transactions: readonly Transaction[];
}

/**
 * Bulk-imports transactions atomically.
 *
 * Every record is built into a {@link Transaction} first, so domain invariant
 * violations surface before anything is persisted — a malformed row aborts the
 * whole import rather than leaving a partial result.
 */
export class ImportTransactions {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(records: readonly ImportTransactionRecord[]): Promise<ImportResult> {
    const built = records.map(
      (record) =>
        new Transaction({
          id: this.idGenerator.next(),
          type: record.type,
          amount: Money.ofMinor(record.amountMinor, record.currency),
          category: record.category,
          occurredAt: record.occurredAt ?? this.clock.now(),
          note: record.note?.trim() ?? "",
        }),
    );

    for (const transaction of built) {
      await this.transactions.save(transaction);
    }

    return { imported: built.length, transactions: built };
  }
}
