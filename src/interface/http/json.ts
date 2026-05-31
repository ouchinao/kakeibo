import { ZodError } from "zod";
import { ApplicationError, NotFoundError } from "../../application/errors.ts";
import { DomainError } from "../../domain/errors.ts";

/** Builds a JSON response with the given status code. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Standard error envelope. */
export interface ErrorBody {
  error: { message: string; code: string; details?: unknown };
}

/**
 * Translates a thrown error into an HTTP response.
 *
 * This is the single place where domain/application errors are mapped to
 * transport status codes, keeping those concerns out of the inner layers.
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return json(
      { error: { message: "Validation failed", code: "VALIDATION_ERROR", details: error.issues } },
      400,
    );
  }
  if (error instanceof NotFoundError) {
    return errorBody(error.message, "NOT_FOUND", 404);
  }
  if (error instanceof DomainError) {
    // Invariant / business-rule violations are client errors.
    return errorBody(error.message, error.name, 400);
  }
  if (error instanceof ApplicationError) {
    return errorBody(error.message, error.name, 400);
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return errorBody(message, "INTERNAL_ERROR", 500);
}

function errorBody(message: string, code: string, status: number): Response {
  return json({ error: { message, code } } satisfies ErrorBody, status);
}
