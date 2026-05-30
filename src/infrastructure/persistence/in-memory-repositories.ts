import { type MonthlyPlan } from "../../domain/monthly-plan.ts";
import { type Reflection } from "../../domain/reflection.ts";
import { type Transaction } from "../../domain/transaction.ts";
import { type YearMonth } from "../../domain/year-month.ts";
import {
  type MonthlyPlanRepository,
  type ReflectionRepository,
  type TransactionRepository,
} from "../../application/ports/repositories.ts";

/**
 * In-memory {@link TransactionRepository}.
 *
 * Used for fast use-case integration tests and as a zero-config backend for
 * local demos. Not durable across process restarts.
 */
export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly store = new Map<string, Transaction>();

  async save(transaction: Transaction): Promise<void> {
    this.store.set(transaction.id, transaction);
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.store.get(id) ?? null;
  }

  async findByMonth(month: YearMonth): Promise<Transaction[]> {
    return [...this.store.values()].filter((tx) => month.contains(tx.occurredAt));
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

/** In-memory {@link MonthlyPlanRepository}, keyed by month string. */
export class InMemoryMonthlyPlanRepository implements MonthlyPlanRepository {
  private readonly store = new Map<string, MonthlyPlan>();

  async save(plan: MonthlyPlan): Promise<void> {
    this.store.set(plan.month.toString(), plan);
  }

  async findByMonth(month: YearMonth): Promise<MonthlyPlan | null> {
    return this.store.get(month.toString()) ?? null;
  }
}

/** In-memory {@link ReflectionRepository}, keyed by month string. */
export class InMemoryReflectionRepository implements ReflectionRepository {
  private readonly store = new Map<string, Reflection>();

  async save(reflection: Reflection): Promise<void> {
    this.store.set(reflection.month.toString(), reflection);
  }

  async findByMonth(month: YearMonth): Promise<Reflection | null> {
    return this.store.get(month.toString()) ?? null;
  }
}
