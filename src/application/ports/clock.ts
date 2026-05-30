/**
 * Abstraction over "the current time".
 *
 * Injecting the clock keeps use cases deterministic and testable: production
 * wiring supplies a system clock, tests supply a fixed one.
 */
export interface Clock {
  now(): Date;
}
