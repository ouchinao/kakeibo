import { type Money } from "../../domain/money.ts";
import { type MonthlyPlan } from "../../domain/monthly-plan.ts";
import { type MonthlySummary } from "../../domain/monthly-summary.ts";
import { REFLECTION_QUESTIONS, type Reflection } from "../../domain/reflection.ts";
import { type Transaction } from "../../domain/transaction.ts";

/**
 * Presenters map domain objects to plain, JSON-serialisable DTOs.
 *
 * Keeping serialisation here means the domain never has to know about its wire
 * format, and the API response shape can evolve independently of the model.
 */

export interface MoneyDto {
  minor: number;
  major: number;
  currency: string;
  formatted: string;
}

export function moneyToDto(money: Money): MoneyDto {
  return {
    minor: money.amount,
    major: money.toMajor(),
    currency: money.currency,
    formatted: money.format(),
  };
}

export function transactionToDto(tx: Transaction) {
  return {
    id: tx.id,
    type: tx.type,
    amount: moneyToDto(tx.amount),
    category: tx.category ?? null,
    occurredAt: tx.occurredAt.toISOString(),
    note: tx.note,
  };
}

export function planToDto(plan: MonthlyPlan) {
  const budgets: Record<string, MoneyDto> = {};
  for (const [category, money] of plan.categoryBudgets) {
    budgets[category] = moneyToDto(money);
  }
  return {
    id: plan.id,
    month: plan.month.toString(),
    currency: plan.currency,
    plannedIncome: moneyToDto(plan.plannedIncome),
    savingsGoal: moneyToDto(plan.savingsGoal),
    availableToSpend: moneyToDto(plan.availableToSpend()),
    categoryBudgets: budgets,
  };
}

export function summaryToDto(summary: MonthlySummary) {
  return {
    month: summary.month.toString(),
    currency: summary.currency,
    hasPlan: summary.hasPlan,
    totalIncome: moneyToDto(summary.totalIncome),
    totalExpense: moneyToDto(summary.totalExpense),
    netBalance: moneyToDto(summary.netBalance),
    plannedIncome: moneyToDto(summary.plannedIncome),
    savingsGoal: moneyToDto(summary.savingsGoal),
    availableToSpend: moneyToDto(summary.availableToSpend),
    remainingToSpend: moneyToDto(summary.remainingToSpend),
    actualSavings: moneyToDto(summary.actualSavings),
    savingsGoalMet: summary.savingsGoalMet,
    categories: summary.categories.map((breakdown) => ({
      category: breakdown.category,
      budget: moneyToDto(breakdown.budget),
      spent: moneyToDto(breakdown.spent),
      remaining: moneyToDto(breakdown.remaining),
      overBudget: breakdown.overBudget,
    })),
  };
}

export function reflectionToDto(reflection: Reflection) {
  const answers: Record<string, string> = {};
  for (const [key, value] of reflection.answers) {
    answers[key] = value;
  }
  return {
    id: reflection.id,
    month: reflection.month.toString(),
    questions: REFLECTION_QUESTIONS,
    answers,
  };
}
