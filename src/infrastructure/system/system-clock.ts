import type { Clock } from "../../application/ports/clock.ts";

/** Production {@link Clock} backed by the real system time. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
