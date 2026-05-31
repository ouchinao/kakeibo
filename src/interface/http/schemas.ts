import { z } from "zod";
import { ALL_CATEGORIES } from "../../domain/category.ts";
import { TransactionType } from "../../domain/transaction.ts";

/**
 * Request validation schemas (the interface layer's anti-corruption boundary).
 *
 * Amounts are accepted in human-friendly *major* units (e.g. 12.34, 1200) and
 * converted to the domain's minor-unit {@link Money} representation by the
 * router. zod guarantees use cases never see malformed input.
 */

const categoryEnum = z.enum(ALL_CATEGORIES as [string, ...string[]]);
const positiveAmount = z.number().finite().positive();
const nonNegativeAmount = z.number().finite().nonnegative();
const currencyCode = z.string().trim().min(1).max(8);

export const recordTransactionSchema = z
  .object({
    type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE]),
    amount: positiveAmount,
    currency: currencyCode.optional(),
    category: categoryEnum.optional(),
    occurredAt: z.string().datetime({ offset: true }).optional(),
    note: z.string().max(500).optional(),
    /** Rate to the base currency (for foreign-currency entries). */
    rate: positiveAmount.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === TransactionType.EXPENSE && value.category === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expenses require a category", path: ["category"] });
    }
    if (value.type === TransactionType.INCOME && value.category !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Income must not have a category", path: ["category"] });
    }
  });

export const saveMonthlyPlanSchema = z.object({
  currency: currencyCode.optional(),
  plannedIncome: nonNegativeAmount,
  savingsGoal: nonNegativeAmount,
  categoryBudgets: z.record(categoryEnum, nonNegativeAmount).optional(),
});

export const saveReflectionSchema = z.object({
  answers: z
    .object({
      howMuchAvailable: z.string().max(2000).optional(),
      howMuchSaved: z.string().max(2000).optional(),
      howMuchSpent: z.string().max(2000).optional(),
      howToImprove: z.string().max(2000).optional(),
    })
    .default({}),
});

export const createRecurringExpenseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: positiveAmount,
  currency: currencyCode.optional(),
  category: categoryEnum,
  dayOfMonth: z.number().int().min(1).max(28),
  active: z.boolean().optional(),
});

export type RecordTransactionInput = z.infer<typeof recordTransactionSchema>;
export type SaveMonthlyPlanInput = z.infer<typeof saveMonthlyPlanSchema>;
export type SaveReflectionInput = z.infer<typeof saveReflectionSchema>;
export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;
