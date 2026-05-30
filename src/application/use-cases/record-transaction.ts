import { type KakeiboCategory } from "../../domain/category.ts";
import { Money } from "../../domain/money.ts";
import { Transaction, type TransactionType } from "../../domain/transaction.ts";
import { type Clock } from "../ports/clock.ts";
import { type IdGenerator } from "../ports/id-generator.ts";
import { type TransactionRepository } from "../ports/repositories.ts";

export interface RecordTransactionCommand {
  readonly type: TransactionType;
  /** Amount in the currency's minor units (e.g. cents); must be positive. */
  readonly amountMinor: number;
  readonly currency: string;
  /** Required for expenses, omitted for income. */
  readonly category?: KakeiboCategory | undefined;
  /** When the money moved; defaults to "now" from the clock. */
  readonly occurredAt?: Date | undefined;
  readonly note?: string | undefined;
}

/**
 * Records a single income or expense.
 *
 * The use case owns ID generation and the "default to now" policy, then
 * delegates invariant enforcement to the {@link Transaction} entity.
 */
export class RecordTransaction {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: RecordTransactionCommand): Promise<Transaction> {
    const transaction = new Transaction({
      id: this.idGenerator.next(),
      type: command.type,
      amount: Money.ofMinor(command.amountMinor, command.currency),
      category: command.category,
      occurredAt: command.occurredAt ?? this.clock.now(),
      note: command.note?.trim() ?? "",
    });

    await this.transactions.save(transaction);
    return transaction;
  }
}
