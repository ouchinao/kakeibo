import type { KakeiboCategory } from "../../domain/category.ts";
import { ExchangeRate } from "../../domain/exchange-rate.ts";
import { Money } from "../../domain/money.ts";
import { RecurringExpense } from "../../domain/recurring-expense.ts";
import { ApplicationError } from "../errors.ts";
import type { IdGenerator } from "../ports/id-generator.ts";
import type { RecurringExpenseRepository } from "../ports/recurring-repositories.ts";

export interface CreateRecurringExpenseCommand {
  readonly name: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly category: KakeiboCategory;
  readonly dayOfMonth: number;
  readonly active?: boolean | undefined;
  /**
   * Exchange rate from the expense's currency to the base currency. Ignored
   * when already in the base currency; **required** otherwise (we never guess
   * a rate), so foreign recurring expenses project into forecasts correctly.
   */
  readonly rate?: number | undefined;
}

/** Creates a new recurring expense definition. */
export class CreateRecurringExpense {
  constructor(
    private readonly recurring: RecurringExpenseRepository,
    private readonly idGenerator: IdGenerator,
    private readonly baseCurrency: string,
  ) {}

  async execute(command: CreateRecurringExpenseCommand): Promise<RecurringExpense> {
    const amount = Money.ofMinor(command.amountMinor, command.currency);
    let baseAmount: Money;
    if (amount.currency === this.baseCurrency) {
      baseAmount = amount;
    } else {
      if (command.rate === undefined) {
        throw new ApplicationError(
          `A rate to ${this.baseCurrency} is required for ${amount.currency} recurring expenses`,
        );
      }
      baseAmount = ExchangeRate.of(amount.currency, this.baseCurrency, command.rate).convert(
        amount,
      );
    }

    const recurring = new RecurringExpense({
      id: this.idGenerator.next(),
      name: command.name,
      amount,
      baseAmount,
      category: command.category,
      dayOfMonth: command.dayOfMonth,
      active: command.active ?? true,
    });
    await this.recurring.save(recurring);
    return recurring;
  }
}
