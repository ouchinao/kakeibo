import { type Database } from "bun:sqlite";
import {
  Reflection,
  type ReflectionQuestionKey,
  REFLECTION_QUESTIONS,
} from "../../domain/reflection.ts";
import { YearMonth } from "../../domain/year-month.ts";
import { type ReflectionRepository } from "../../application/ports/repositories.ts";

interface ReflectionRow {
  month: string;
  id: string;
  answers_json: string;
}

function toDomain(row: ReflectionRow): Reflection {
  const raw = JSON.parse(row.answers_json) as Record<string, string>;
  const answers = new Map<ReflectionQuestionKey, string>();
  for (const key of Object.keys(REFLECTION_QUESTIONS) as ReflectionQuestionKey[]) {
    const value = raw[key];
    if (typeof value === "string") {
      answers.set(key, value);
    }
  }
  return new Reflection({ id: row.id, month: YearMonth.parse(row.month), answers });
}

/** SQLite-backed {@link ReflectionRepository}, one row per month. */
export class SqliteReflectionRepository implements ReflectionRepository {
  constructor(private readonly db: Database) {}

  async save(reflection: Reflection): Promise<void> {
    const answers: Record<string, string> = {};
    for (const [key, value] of reflection.answers) {
      answers[key] = value;
    }
    this.db
      .query(
        `INSERT OR REPLACE INTO reflections (month, id, answers_json)
         VALUES ($month, $id, $answers)`,
      )
      .run({
        $month: reflection.month.toString(),
        $id: reflection.id,
        $answers: JSON.stringify(answers),
      });
  }

  async findByMonth(month: YearMonth): Promise<Reflection | null> {
    const row = this.db
      .query("SELECT * FROM reflections WHERE month = $month")
      .get({ $month: month.toString() }) as ReflectionRow | null;
    return row === null ? null : toDomain(row);
  }
}
