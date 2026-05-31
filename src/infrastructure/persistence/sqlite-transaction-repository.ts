import { type Database } from "bun:sqlite";
import { type KakeiboCategory, toKakeiboCategory } from "../../domain/category.ts";
import { Money } from "../../domain/money.ts";
import { Transaction, type TransactionType } from "../../domain/transaction.ts";
import { type YearMonth } from "../../domain/year-month.ts";
import { type TransactionRepository } from "../../application/ports/repositories.ts";

interface TransactionRow {
  id: string;
  type: string;
  amount_minor: number;
  currency: string;
  category: string | null;
  occurred_at: string;
  note: string;
}

function toDomain(row: TransactionRow): Transaction {
  return new Transaction({
    id: row.id,
    type: row.type as TransactionType,
    amount: Money.ofMinor(row.amount_minor, row.currency),
    category: row.category === null ? undefined : toKakeiboCategory(row.category),
    occurredAt: new Date(row.occurred_at),
    note: row.note,
  });
}

/** Maps a domain transaction to the bound parameters for an insert statement. */
function toParams(transaction: Transaction): Record<string, string | number | null> {
  return {
    $id: transaction.id,
    $type: transaction.type,
    $amount: transaction.amount.amount,
    $currency: transaction.amount.currency,
    $category: (transaction.category as KakeiboCategory | undefined) ?? null,
    $occurredAt: transaction.occurredAt.toISOString(),
    $note: transaction.note,
  };
}

const INSERT_OR_REPLACE_SQL = `INSERT OR REPLACE INTO transactions
   (id, type, amount_minor, currency, category, occurred_at, note)
 VALUES ($id, $type, $amount, $currency, $category, $occurredAt, $note)`;

const INSERT_SQL = `INSERT INTO transactions
   (id, type, amount_minor, currency, category, occurred_at, note)
 VALUES ($id, $type, $amount, $currency, $category, $occurredAt, $note)`;

/** SQLite-backed {@link TransactionRepository} using `bun:sqlite`. */
export class SqliteTransactionRepository implements TransactionRepository {
  constructor(private readonly db: Database) {}

  async save(transaction: Transaction): Promise<void> {
    this.db.query(INSERT_OR_REPLACE_SQL).run(toParams(transaction));
  }

  async saveMany(transactions: readonly Transaction[]): Promise<void> {
    const insert = this.db.query(INSERT_SQL);
    // db.transaction wraps the batch in BEGIN/COMMIT and rolls back on throw,
    // so a failing row leaves none of the batch persisted.
    const run = this.db.transaction((rows: readonly Transaction[]) => {
      for (const transaction of rows) {
        insert.run(toParams(transaction));
      }
    });
    run(transactions);
  }

  async findById(id: string): Promise<Transaction | null> {
    const row = this.db
      .query("SELECT * FROM transactions WHERE id = $id")
      .get({ $id: id }) as TransactionRow | null;
    return row === null ? null : toDomain(row);
  }

  async findByMonth(month: YearMonth): Promise<Transaction[]> {
    const rows = this.db
      .query("SELECT * FROM transactions WHERE substr(occurred_at, 1, 7) = $month")
      .all({ $month: month.toString() }) as TransactionRow[];
    return rows.map(toDomain);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.query("DELETE FROM transactions WHERE id = $id").run({ $id: id });
    return result.changes > 0;
  }
}
