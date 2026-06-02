import { NotFoundError } from "../errors.ts";
import type { TransactionRepository } from "../ports/repositories.ts";

/**
 * Deletes a transaction by id.
 *
 * @throws {NotFoundError} when no transaction with the id exists.
 */
export class DeleteTransaction {
  constructor(private readonly transactions: TransactionRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.transactions.delete(id);
    if (!deleted) {
      throw new NotFoundError("Transaction", id);
    }
  }
}
