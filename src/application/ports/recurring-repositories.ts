import type { RecurringExpense } from "../../domain/recurring-expense.ts";
import type { YearMonth } from "../../domain/year-month.ts";

/**
 * Persistence boundary for {@link RecurringExpense} definitions.
 */
export interface RecurringExpenseRepository {
  save(recurring: RecurringExpense): Promise<void>;
  findById(id: string): Promise<RecurringExpense | null>;
  /** All recurring expenses, active and inactive, in insertion order. */
  listAll(): Promise<RecurringExpense[]>;
  delete(id: string): Promise<boolean>;
}

/**
 * Ledger recording which recurring expenses have already been auto-posted as a
 * transaction in a given month. Keeps auto-posting idempotent and prevents the
 * forecast from double-counting a charge that has already been recorded.
 */
export interface RecurringPostingLog {
  isPosted(recurringId: string, month: YearMonth): Promise<boolean>;
  markPosted(recurringId: string, month: YearMonth): Promise<void>;
  /** Returns the ids of recurring expenses already posted in the month. */
  postedIds(month: YearMonth): Promise<Set<string>>;
}
