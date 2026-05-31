import { Database } from "bun:sqlite";

/**
 * Opens a SQLite database and applies the schema.
 *
 * Bun ships an embedded SQLite engine (`bun:sqlite`), so persistence needs no
 * external service — a perfect fit for this privacy-first, offline app. Pass
 * ":memory:" for an ephemeral database (used by integration tests).
 */
export function openDatabase(path: string): Database {
  const db = new Database(path, { create: true });
  // WAL improves concurrent read/write behaviour for the local server.
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

/** Creates the schema if it does not already exist (idempotent). */
export function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
      amount_minor INTEGER NOT NULL,
      currency    TEXT NOT NULL,
      category    TEXT,
      occurred_at TEXT NOT NULL,
      note        TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_month
      ON transactions (substr(occurred_at, 1, 7));

    CREATE TABLE IF NOT EXISTS monthly_plans (
      month                 TEXT PRIMARY KEY,
      id                    TEXT NOT NULL,
      currency              TEXT NOT NULL,
      planned_income_minor  INTEGER NOT NULL,
      savings_goal_minor    INTEGER NOT NULL,
      category_budgets_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS reflections (
      month        TEXT PRIMARY KEY,
      id           TEXT NOT NULL,
      answers_json TEXT NOT NULL DEFAULT '{}'
    );
  `);
}
