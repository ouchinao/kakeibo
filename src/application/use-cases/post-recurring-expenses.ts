import { Transaction, TransactionType } from "../../domain/transaction.ts";
import { YearMonth } from "../../domain/year-month.ts";
import { type IdGenerator } from "../ports/id-generator.ts";
import {
  type RecurringExpenseRepository,
  type RecurringPostingLog,
} from "../ports/recurring-repositories.ts";
import { type TransactionRepository } from "../ports/repositories.ts";

export interface PostRecurringResult {
  readonly posted: number;
  readonly transactions: readonly Transaction[];
}

/**
 * Auto-posts active recurring expenses as transactions for a month.
 *
 * Idempotent: an expense already posted for the month (recorded in the posting
 * log) is skipped, so running it twice does not create duplicates.
 */
export class PostRecurringExpenses {
  constructor(
    private readonly recurring: RecurringExpenseRepository,
    private readonly postingLog: RecurringPostingLog,
    private readonly transactions: TransactionRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(month: string | YearMonth): Promise<PostRecurringResult> {
    const yearMonth = typeof month === "string" ? YearMonth.parse(month) : month;
    const [all, alreadyPosted] = await Promise.all([
      this.recurring.listAll(),
      this.postingLog.postedIds(yearMonth),
    ]);

    const created: Transaction[] = [];
    for (const recurring of all) {
      if (!recurring.active || alreadyPosted.has(recurring.id)) continue;

      const transaction = new Transaction({
        id: this.idGenerator.next(),
        type: TransactionType.EXPENSE,
        amount: recurring.amount,
        category: recurring.category,
        occurredAt: recurring.scheduledDate(yearMonth),
        note: recurring.name,
      });
      await this.transactions.save(transaction);
      await this.postingLog.markPosted(recurring.id, yearMonth);
      created.push(transaction);
    }

    return { posted: created.length, transactions: created };
  }
}
