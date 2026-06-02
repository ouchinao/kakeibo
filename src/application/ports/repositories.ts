import type { MonthlyPlan } from "../../domain/monthly-plan.ts";
import type { Reflection } from "../../domain/reflection.ts";
import type { Transaction } from "../../domain/transaction.ts";
import type { YearMonth } from "../../domain/year-month.ts";

/**
 * Persistence boundary for {@link Transaction} aggregates.
 *
 * Defined in the application layer (a "port"); concrete adapters live in the
 * infrastructure layer. The domain never depends on these interfaces — only
 * use cases do.
 */
export interface TransactionRepository {
  save(transaction: Transaction): Promise<void>;
  /**
   * Persists several new transactions atomically: either all are written or,
   * if any insert fails, none are (the batch is rolled back).
   */
  saveMany(transactions: readonly Transaction[]): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
  /** Returns all transactions that occurred within the given month. */
  findByMonth(month: YearMonth): Promise<Transaction[]>;
  /** Removes a transaction; resolves true when something was deleted. */
  delete(id: string): Promise<boolean>;
}

/**
 * Persistence boundary for {@link MonthlyPlan}.
 *
 * A month has at most one plan, so `save` behaves as an upsert keyed by month.
 */
export interface MonthlyPlanRepository {
  save(plan: MonthlyPlan): Promise<void>;
  findByMonth(month: YearMonth): Promise<MonthlyPlan | null>;
}

/**
 * Persistence boundary for {@link Reflection}.
 *
 * A month has at most one reflection, so `save` behaves as an upsert keyed by
 * month.
 */
export interface ReflectionRepository {
  save(reflection: Reflection): Promise<void>;
  findByMonth(month: YearMonth): Promise<Reflection | null>;
}
