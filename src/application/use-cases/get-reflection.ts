import { type Reflection } from "../../domain/reflection.ts";
import { YearMonth } from "../../domain/year-month.ts";
import { type ReflectionRepository } from "../ports/repositories.ts";

/** Fetches the reflection for a month, or null when none exists yet. */
export class GetReflection {
  constructor(private readonly reflections: ReflectionRepository) {}

  async execute(month: string | YearMonth): Promise<Reflection | null> {
    const yearMonth = typeof month === "string" ? YearMonth.parse(month) : month;
    return this.reflections.findByMonth(yearMonth);
  }
}
