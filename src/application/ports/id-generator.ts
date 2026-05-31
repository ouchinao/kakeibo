/**
 * Abstraction over identifier generation.
 *
 * Keeps the domain free of any specific ID strategy (UUID, ULID, etc.) and
 * lets tests use predictable identifiers.
 */
export interface IdGenerator {
  next(): string;
}
