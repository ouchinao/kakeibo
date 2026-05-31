import { type RecurringExpense } from "../../domain/recurring-expense.ts";
import { type RecurringExpenseRepository } from "../ports/recurring-repositories.ts";

/** Lists every recurring expense definition (active and inactive). */
export class ListRecurringExpenses {
  constructor(private readonly recurring: RecurringExpenseRepository) {}

  async execute(): Promise<RecurringExpense[]> {
    return this.recurring.listAll();
  }
}
