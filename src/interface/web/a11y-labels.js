// Accessible-name builders for the per-row "Delete" buttons.
//
// Pure (no DOM) so they are unit-tested directly. The caller is responsible
// for HTML-escaping the result before embedding it in an attribute.

/** Distinct accessible name for a transaction's Delete button. */
export function deleteTransactionAriaLabel(tx, t) {
  const date = tx.occurredAt.slice(0, 10);
  const parts = [t("button.delete"), date, tx.amount.formatted];
  if (tx.note) parts.push(tx.note);
  return parts.join(" ");
}

/** Distinct accessible name for a recurring expense's Delete button. */
export function deleteRecurringAriaLabel(recurring, t) {
  return `${t("button.delete")} ${recurring.name} ${recurring.amount.formatted}`;
}

/**
 * Text alternative for the trend chart: a per-month spoken summary so screen
 * readers can access the data the SVG conveys visually.
 */
export function trendChartAriaLabel(points, t) {
  if (points.length === 0) return t("trend.none");
  const months = points
    .map(
      (p) =>
        `${p.month}: ${t("type.income")} ${p.totalIncome.formatted}, ` +
        `${t("type.expense")} ${p.totalExpense.formatted}, ` +
        `${t("trend.savings")} ${p.actualSavings.formatted}`,
    )
    .join("; ");
  return `${t("heading.trend")} — ${months}`;
}
