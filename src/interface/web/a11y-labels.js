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
