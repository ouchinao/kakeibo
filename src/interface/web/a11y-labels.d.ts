// Type declarations for the browser-served a11y-labels module (a11y-labels.js).

type Translate = (key: string) => string;

interface TransactionLike {
  occurredAt: string;
  amount: { formatted: string };
  note: string;
}

interface RecurringLike {
  name: string;
  amount: { formatted: string };
}

interface TrendPointLike {
  month: string;
  totalIncome: { formatted: string };
  totalExpense: { formatted: string };
  actualSavings: { formatted: string };
}

export function deleteTransactionAriaLabel(tx: TransactionLike, t: Translate): string;
export function deleteRecurringAriaLabel(recurring: RecurringLike, t: Translate): string;
export function trendChartAriaLabel(points: readonly TrendPointLike[], t: Translate): string;
