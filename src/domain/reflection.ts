import type { YearMonth } from "./year-month.ts";

/**
 * The four reflective questions that close every kakeibo cycle.
 *
 * Answering them is the deliberate "mindfulness" step that turns raw numbers
 * into behaviour change — the part that automated bank-sync apps omit.
 */
export const REFLECTION_QUESTIONS = {
  howMuchAvailable: "How much money did you have available?",
  howMuchSaved: "How much money did you manage to save?",
  howMuchSpent: "How much money did you actually spend?",
  howToImprove: "How can you improve next month?",
} as const;

export type ReflectionQuestionKey = keyof typeof REFLECTION_QUESTIONS;

export interface ReflectionProps {
  readonly id: string;
  readonly month: YearMonth;
  readonly answers: ReadonlyMap<ReflectionQuestionKey, string>;
}

/**
 * A month-end reflection: free-text answers to the kakeibo questions.
 *
 * The entity is intentionally permissive about completeness — partial
 * reflections are still valuable — but normalises answers (trimmed) and drops
 * empty ones so the read model stays clean.
 */
export class Reflection {
  readonly id: string;
  readonly month: YearMonth;
  readonly answers: ReadonlyMap<ReflectionQuestionKey, string>;

  constructor(props: ReflectionProps) {
    const cleaned = new Map<ReflectionQuestionKey, string>();
    for (const [key, value] of props.answers) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        cleaned.set(key, trimmed);
      }
    }
    this.id = props.id;
    this.month = props.month;
    this.answers = cleaned;
    Object.freeze(this);
  }

  /** The answer to a specific question, if provided. */
  answerFor(key: ReflectionQuestionKey): string | undefined {
    return this.answers.get(key);
  }

  /** True when at least one question has been answered. */
  hasContent(): boolean {
    return this.answers.size > 0;
  }
}
