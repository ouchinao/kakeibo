import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { migrate } from "../../src/infrastructure/persistence/database.ts";

let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  migrate(db);
});

afterEach(() => {
  db.close();
});

describe("migrate", () => {
  test("creates an index on recurring_postings(month) for fast forecast lookups", () => {
    const row = db
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'recurring_postings' AND name = $name",
      )
      .get({ $name: "idx_recurring_postings_month" });
    expect(row).not.toBeNull();
  });

  test("is idempotent (safe to run twice)", () => {
    expect(() => migrate(db)).not.toThrow();
  });
});
