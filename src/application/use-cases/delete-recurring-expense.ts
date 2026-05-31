import { NotFoundError } from "../errors.ts";
import { type RecurringExpenseRepository } from "../ports/recurring-repositories.ts";

/**
 * Deletes a recurring expense definition by id.
 *
 * Already-posted transactions are intentionally left untouched — deleting a
 * definition only stops future auto-posting.
 *
 * @throws {NotFoundError} when no recurring expense with the id exists.
 */
export class DeleteRecurringExpense {
  constructor(private readonly recurring: RecurringExpenseRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.recurring.delete(id);
    if (!deleted) {
      throw new NotFoundError("RecurringExpense", id);
    }
  }
}
