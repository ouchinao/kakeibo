import type { Database } from "bun:sqlite";
import type {
  RecurringExpenseRepository,
  RecurringPostingLog,
} from "../../application/ports/recurring-repositories.ts";
import { toKakeiboCategory } from "../../domain/category.ts";
import { Money } from "../../domain/money.ts";
import { RecurringExpense } from "../../domain/recurring-expense.ts";
import type { YearMonth } from "../../domain/year-month.ts";

interface RecurringRow {
  id: string;
  name: string;
  amount_minor: number;
  currency: string;
  category: string;
  day_of_month: number;
  active: number;
  base_amount_minor: number | null;
  base_currency: string | null;
}

function toDomain(row: RecurringRow): RecurringExpense {
  // Legacy rows have no base amount; the entity then defaults it to the amount.
  const baseAmount =
    row.base_amount_minor !== null && row.base_currency !== null
      ? Money.ofMinor(row.base_amount_minor, row.base_currency)
      : undefined;
  return new RecurringExpense({
    id: row.id,
    name: row.name,
    amount: Money.ofMinor(row.amount_minor, row.currency),
    baseAmount,
    category: toKakeiboCategory(row.category),
    dayOfMonth: row.day_of_month,
    active: row.active === 1,
  });
}

/** SQLite-backed {@link RecurringExpenseRepository}; lists in insertion order. */
export class SqliteRecurringExpenseRepository implements RecurringExpenseRepository {
  constructor(private readonly db: Database) {}

  async save(recurring: RecurringExpense): Promise<void> {
    this.db
      .query(
        `INSERT OR REPLACE INTO recurring_expenses
           (id, name, amount_minor, currency, category, day_of_month, active,
            base_amount_minor, base_currency)
         VALUES ($id, $name, $amount, $currency, $category, $day, $active,
            $baseAmount, $baseCurrency)`,
      )
      .run({
        $id: recurring.id,
        $name: recurring.name,
        $amount: recurring.amount.amount,
        $currency: recurring.amount.currency,
        $category: recurring.category,
        $day: recurring.dayOfMonth,
        $active: recurring.active ? 1 : 0,
        $baseAmount: recurring.baseAmount.amount,
        $baseCurrency: recurring.baseAmount.currency,
      });
  }

  async findById(id: string): Promise<RecurringExpense | null> {
    const row = this.db
      .query("SELECT * FROM recurring_expenses WHERE id = $id")
      .get({ $id: id }) as RecurringRow | null;
    return row === null ? null : toDomain(row);
  }

  async listAll(): Promise<RecurringExpense[]> {
    const rows = this.db
      .query("SELECT * FROM recurring_expenses ORDER BY rowid ASC")
      .all() as RecurringRow[];
    return rows.map(toDomain);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.query("DELETE FROM recurring_expenses WHERE id = $id").run({ $id: id });
    return result.changes > 0;
  }
}

/** SQLite-backed {@link RecurringPostingLog}. */
export class SqliteRecurringPostingLog implements RecurringPostingLog {
  constructor(private readonly db: Database) {}

  async isPosted(recurringId: string, month: YearMonth): Promise<boolean> {
    const row = this.db
      .query("SELECT 1 FROM recurring_postings WHERE recurring_id = $id AND month = $month")
      .get({ $id: recurringId, $month: month.toString() });
    return row !== null;
  }

  async markPosted(recurringId: string, month: YearMonth): Promise<void> {
    this.db
      .query(
        `INSERT OR IGNORE INTO recurring_postings (recurring_id, month)
         VALUES ($id, $month)`,
      )
      .run({ $id: recurringId, $month: month.toString() });
  }

  async postedIds(month: YearMonth): Promise<Set<string>> {
    const rows = this.db
      .query("SELECT recurring_id FROM recurring_postings WHERE month = $month")
      .all({ $month: month.toString() }) as { recurring_id: string }[];
    return new Set(rows.map((r) => r.recurring_id));
  }
}
