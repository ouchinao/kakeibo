import {
  Reflection,
  type ReflectionQuestionKey,
  REFLECTION_QUESTIONS,
} from "../../domain/reflection.ts";
import { YearMonth } from "../../domain/year-month.ts";
import { type IdGenerator } from "../ports/id-generator.ts";
import { type ReflectionRepository } from "../ports/repositories.ts";

export interface SaveReflectionCommand {
  readonly month: string | YearMonth;
  readonly answers: { readonly [K in ReflectionQuestionKey]?: string | undefined };
}

/**
 * Creates or updates a month's reflection (upsert keyed by month).
 *
 * Unknown answer keys are ignored so the stored reflection only ever contains
 * the four canonical kakeibo questions.
 */
export class SaveReflection {
  constructor(
    private readonly reflections: ReflectionRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(command: SaveReflectionCommand): Promise<Reflection> {
    const month =
      typeof command.month === "string" ? YearMonth.parse(command.month) : command.month;

    const answers = new Map<ReflectionQuestionKey, string>();
    for (const key of Object.keys(REFLECTION_QUESTIONS) as ReflectionQuestionKey[]) {
      const value = command.answers[key];
      if (value !== undefined) {
        answers.set(key, value);
      }
    }

    const existing = await this.reflections.findByMonth(month);
    const reflection = new Reflection({
      id: existing?.id ?? this.idGenerator.next(),
      month,
      answers,
    });

    await this.reflections.save(reflection);
    return reflection;
  }
}
