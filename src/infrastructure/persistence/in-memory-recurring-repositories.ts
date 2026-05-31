import { type RecurringExpense } from "../../domain/recurring-expense.ts";
import { type YearMonth } from "../../domain/year-month.ts";
import {
  type RecurringExpenseRepository,
  type RecurringPostingLog,
} from "../../application/ports/recurring-repositories.ts";

/** In-memory {@link RecurringExpenseRepository}, preserving insertion order. */
export class InMemoryRecurringExpenseRepository implements RecurringExpenseRepository {
  private readonly store = new Map<string, RecurringExpense>();

  async save(recurring: RecurringExpense): Promise<void> {
    this.store.set(recurring.id, recurring);
  }

  async findById(id: string): Promise<RecurringExpense | null> {
    return this.store.get(id) ?? null;
  }

  async listAll(): Promise<RecurringExpense[]> {
    return [...this.store.values()];
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

/** In-memory {@link RecurringPostingLog}, keyed by "month:recurringId". */
export class InMemoryRecurringPostingLog implements RecurringPostingLog {
  private readonly posted = new Set<string>();

  private key(recurringId: string, month: YearMonth): string {
    return `${month.toString()}:${recurringId}`;
  }

  async isPosted(recurringId: string, month: YearMonth): Promise<boolean> {
    return this.posted.has(this.key(recurringId, month));
  }

  async markPosted(recurringId: string, month: YearMonth): Promise<void> {
    this.posted.add(this.key(recurringId, month));
  }

  async postedIds(month: YearMonth): Promise<Set<string>> {
    const prefix = `${month.toString()}:`;
    const ids = new Set<string>();
    for (const key of this.posted) {
      if (key.startsWith(prefix)) ids.add(key.slice(prefix.length));
    }
    return ids;
  }
}
