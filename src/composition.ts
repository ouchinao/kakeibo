import { type Database } from "bun:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getCurrency } from "./domain/currency.ts";
import { DeleteTransaction } from "./application/use-cases/delete-transaction.ts";
import { GetMonthlyPlan } from "./application/use-cases/get-monthly-plan.ts";
import { GetMonthlySummary } from "./application/use-cases/get-monthly-summary.ts";
import { GetReflection } from "./application/use-cases/get-reflection.ts";
import { ImportTransactions } from "./application/use-cases/import-transactions.ts";
import { ListTransactions } from "./application/use-cases/list-transactions.ts";
import { RecordTransaction } from "./application/use-cases/record-transaction.ts";
import { SaveMonthlyPlan } from "./application/use-cases/save-monthly-plan.ts";
import { SaveReflection } from "./application/use-cases/save-reflection.ts";
import { openDatabase } from "./infrastructure/persistence/database.ts";
import { SqliteMonthlyPlanRepository } from "./infrastructure/persistence/sqlite-monthly-plan-repository.ts";
import { SqliteReflectionRepository } from "./infrastructure/persistence/sqlite-reflection-repository.ts";
import { SqliteTransactionRepository } from "./infrastructure/persistence/sqlite-transaction-repository.ts";
import { SystemClock } from "./infrastructure/system/system-clock.ts";
import { UuidIdGenerator } from "./infrastructure/system/uuid-id-generator.ts";
import { createRouter } from "./interface/http/router.ts";
import { createStaticHandler } from "./interface/http/static.ts";

export interface AppConfig {
  /** SQLite file path, or ":memory:" for an ephemeral database. */
  databasePath: string;
  /** ISO 4217 code used when a request omits a currency. */
  defaultCurrency: string;
}

export interface App {
  /** The HTTP request handler, ready for `Bun.serve` or direct invocation. */
  fetch: (req: Request) => Promise<Response>;
  db: Database;
  /** Releases the database handle. */
  close(): void;
}

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "interface", "web");

/**
 * Composition root: the single place where concrete implementations are chosen
 * and wired together. Every other module depends only on abstractions, which
 * is what keeps the architecture "clean" and the inner layers test-friendly.
 */
export function createApp(config: AppConfig): App {
  // Fail fast on an unsupported default currency.
  getCurrency(config.defaultCurrency);

  const db = openDatabase(config.databasePath);

  const transactions = new SqliteTransactionRepository(db);
  const plans = new SqliteMonthlyPlanRepository(db);
  const reflections = new SqliteReflectionRepository(db);
  const ids = new UuidIdGenerator();
  const clock = new SystemClock();

  const fetch = createRouter({
    recordTransaction: new RecordTransaction(transactions, ids, clock),
    listTransactions: new ListTransactions(transactions),
    deleteTransaction: new DeleteTransaction(transactions),
    saveMonthlyPlan: new SaveMonthlyPlan(plans, ids),
    getMonthlyPlan: new GetMonthlyPlan(plans),
    getMonthlySummary: new GetMonthlySummary(transactions, plans, config.defaultCurrency),
    saveReflection: new SaveReflection(reflections, ids),
    getReflection: new GetReflection(reflections),
    importTransactions: new ImportTransactions(transactions, ids, clock),
    defaultCurrency: config.defaultCurrency,
    serveStatic: createStaticHandler(WEB_ROOT),
  });

  return {
    fetch,
    db,
    close: () => db.close(),
  };
}
