import { InvalidValueError } from "./errors.ts";

/**
 * The four spending pillars of the kakeibo method.
 *
 * Every expense is intentionally classified into exactly one pillar. This
 * deliberate categorisation is the core mindfulness mechanic of kakeibo and is
 * what drives its documented savings improvements over passive auto-tracking.
 */
export const KakeiboCategory = {
  /** Survival / needs: rent, groceries, utilities, transport, medical. */
  NEEDS: "NEEDS",
  /** Wants: dining out, shopping, entertainment subscriptions. */
  WANTS: "WANTS",
  /** Culture & leisure: books, museums, courses, hobbies. */
  CULTURE: "CULTURE",
  /** Unexpected / extra: repairs, gifts, emergencies. */
  UNEXPECTED: "UNEXPECTED",
} as const;

export type KakeiboCategory = (typeof KakeiboCategory)[keyof typeof KakeiboCategory];

/** All categories in canonical display order. */
export const ALL_CATEGORIES: readonly KakeiboCategory[] = Object.values(KakeiboCategory);

/** Returns true when the value is a valid kakeibo category. */
export function isKakeiboCategory(value: string): value is KakeiboCategory {
  return (ALL_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Narrows an arbitrary string to a KakeiboCategory.
 *
 * @throws {InvalidValueError} when the value is not a known category.
 */
export function toKakeiboCategory(value: string): KakeiboCategory {
  if (!isKakeiboCategory(value)) {
    throw new InvalidValueError(
      `Unknown category: "${value}". Expected one of: ${ALL_CATEGORIES.join(", ")}`,
    );
  }
  return value;
}
