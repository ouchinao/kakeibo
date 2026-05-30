/**
 * Base class for all domain-level errors.
 *
 * Domain errors represent violations of business rules (invariants) and are
 * intentionally decoupled from any transport concern (HTTP status codes, etc.).
 * Outer layers translate them into the appropriate protocol response.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when a value object is constructed with invalid input. */
export class InvalidValueError extends DomainError {}

/** Raised when two monetary amounts of different currencies are combined. */
export class CurrencyMismatchError extends DomainError {
  constructor(left: string, right: string) {
    super(`Cannot operate on amounts with different currencies: ${left} vs ${right}`);
  }
}

/** Raised when a business rule is violated during an entity operation. */
export class BusinessRuleError extends DomainError {}
