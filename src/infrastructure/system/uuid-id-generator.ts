import type { IdGenerator } from "../../application/ports/id-generator.ts";

/** Production {@link IdGenerator} producing RFC 4122 v4 UUIDs. */
export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return crypto.randomUUID();
  }
}
