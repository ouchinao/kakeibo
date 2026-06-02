import type { Transaction } from "../../domain/transaction.ts";
import { YearMonth } from "../../domain/year-month.ts";
import type { TransactionRepository } from "../ports/repositories.ts";

/**
 * Lists every transaction recorded in a given month, most recent first.
 */
export class ListTransactions {
  constructor(private readonly transactions: TransactionRepository) {}

  async execute(month: string | YearMonth): Promise<Transaction[]> {
    const yearMonth = typeof month === "string" ? YearMonth.parse(month) : month;
    const found = await this.transactions.findByMonth(yearMonth);
    return found.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }
}
