/** Base class for errors that originate in the application (use-case) layer. */
export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when a requested resource does not exist. */
export class NotFoundError extends ApplicationError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
  }
}
