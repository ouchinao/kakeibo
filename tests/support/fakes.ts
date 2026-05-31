import { type Clock } from "../../src/application/ports/clock.ts";
import { type IdGenerator } from "../../src/application/ports/id-generator.ts";

/** Deterministic {@link Clock} for tests; time can be advanced manually. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  set(date: Date): void {
    this.current = date;
  }
}

/** Predictable {@link IdGenerator} yielding "id-1", "id-2", ... for tests. */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}
