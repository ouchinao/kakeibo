import { type KakeiboCategory } from "../../domain/category.ts";
import { ExchangeRate } from "../../domain/exchange-rate.ts";
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
  /**
   * Exchange rate from the transaction's currency to the base currency, used to
   * record the base-currency equivalent. Ignored when the transaction is
   * already in the base currency; defaults to 1 (manual fallback) otherwise.
   */
  readonly rate?: number | undefined;
}

/**
 * Records a single income or expense, capturing its base-currency equivalent at
 * booking time so mixed-currency months aggregate correctly.
 *
 * The use case owns ID generation, the "default to now" policy, and the
 * base-currency conversion; the {@link Transaction} entity enforces invariants.
 */
export class RecordTransaction {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly baseCurrency: string,
  ) {}

  async execute(command: RecordTransactionCommand): Promise<Transaction> {
    const amount = Money.ofMinor(command.amountMinor, command.currency);
    const baseAmount =
      amount.currency === this.baseCurrency
        ? amount
        : ExchangeRate.of(amount.currency, this.baseCurrency, command.rate ?? 1).convert(amount);

    const transaction = new Transaction({
      id: this.idGenerator.next(),
      type: command.type,
      amount,
      baseAmount,
      category: command.category,
      occurredAt: command.occurredAt ?? this.clock.now(),
      note: command.note?.trim() ?? "",
    });

    await this.transactions.save(transaction);
    return transaction;
  }
}
