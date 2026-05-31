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
 * Bulk-imports transactions.
 *
 * Fully atomic: every record is first built into a {@link Transaction} (so a
 * domain-invalid row aborts before any write), then the whole batch is
 * persisted via {@link TransactionRepository.saveMany}, which commits all rows
 * or none. A malformed row or a mid-batch persistence failure leaves the
 * database unchanged.
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

    // Persist the whole batch atomically: a failure leaves nothing written.
    await this.transactions.saveMany(built);

    return { imported: built.length, transactions: built };
  }
}
