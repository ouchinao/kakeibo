import { type KakeiboCategory } from "../../domain/category.ts";
import { Money } from "../../domain/money.ts";
import { RecurringExpense } from "../../domain/recurring-expense.ts";
import { type IdGenerator } from "../ports/id-generator.ts";
import { type RecurringExpenseRepository } from "../ports/recurring-repositories.ts";

export interface CreateRecurringExpenseCommand {
  readonly name: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly category: KakeiboCategory;
  readonly dayOfMonth: number;
  readonly active?: boolean | undefined;
}

/** Creates a new recurring expense definition. */
export class CreateRecurringExpense {
  constructor(
    private readonly recurring: RecurringExpenseRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(command: CreateRecurringExpenseCommand): Promise<RecurringExpense> {
    const recurring = new RecurringExpense({
      id: this.idGenerator.next(),
      name: command.name,
      amount: Money.ofMinor(command.amountMinor, command.currency),
      category: command.category,
      dayOfMonth: command.dayOfMonth,
      active: command.active ?? true,
    });
    await this.recurring.save(recurring);
    return recurring;
  }
}
