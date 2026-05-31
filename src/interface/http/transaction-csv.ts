import { toKakeiboCategory } from "../../domain/category.ts";
import { Money } from "../../domain/money.ts";
import { type Transaction, TransactionType } from "../../domain/transaction.ts";
import { ApplicationError } from "../../application/errors.ts";
import { type ImportTransactionRecord } from "../../application/use-cases/import-transactions.ts";
import { parseCsv, stringifyCsv } from "./csv.ts";

/** Raised when an imported CSV is structurally invalid (mapped to HTTP 400). */
export class CsvImportError extends ApplicationError {}

const HEADER = [
  "date",
  "type",
  "category",
  "amount",
  "currency",
  "base_amount",
  "base_currency",
  "note",
] as const;

/** Serialises transactions to CSV with a stable header row. */
export function transactionsToCsv(transactions: readonly Transaction[]): string {
  const rows: string[][] = [[...HEADER]];
  for (const tx of transactions) {
    rows.push([
      tx.occurredAt.toISOString(),
      tx.type,
      tx.category ?? "",
      String(tx.amount.toMajor()),
      tx.amount.currency,
      // The base-currency equivalent travels with the row so foreign entries
      // round-trip without losing their booking-time conversion.
      String(tx.baseAmount.toMajor()),
      tx.baseAmount.currency,
      tx.note,
    ]);
  }
  return stringifyCsv(rows);
}

/**
 * Parses a CSV document into import records, validating each row.
 *
 * Columns are matched by header name (order-independent). `amount` is read in
 * major units and converted to the domain's minor-unit representation.
 *
 * @throws {CsvImportError} on a missing header column or an invalid row.
 */
export function csvToImportRecords(
  csv: string,
  defaultCurrency: string,
): ImportTransactionRecord[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    throw new CsvImportError("CSV is empty");
  }

  const header = (rows[0] as string[]).map((h) => h.trim().toLowerCase());
  const index = (name: string): number => {
    const at = header.indexOf(name);
    if (at === -1) throw new CsvImportError(`Missing required column: "${name}"`);
    return at;
  };
  const cols = {
    date: index("date"),
    type: index("type"),
    category: index("category"),
    amount: index("amount"),
    currency: header.indexOf("currency"),
    baseAmount: header.indexOf("base_amount"),
    baseCurrency: header.indexOf("base_currency"),
    note: header.indexOf("note"),
  };

  const records: ImportTransactionRecord[] = [];
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r] as string[];
    const line = r + 1; // human-friendly (1-based, header included)
    const get = (at: number): string => (at >= 0 ? (row[at] ?? "").trim() : "");

    const rawType = get(cols.type).toUpperCase();
    if (rawType !== TransactionType.INCOME && rawType !== TransactionType.EXPENSE) {
      throw new CsvImportError(`Row ${line}: invalid type "${get(cols.type)}"`);
    }
    const type = rawType as TransactionType;

    // Validate the amount at the CSV layer so the error carries the row number.
    // An empty, non-numeric, or non-positive amount is rejected here rather
    // than surfacing later as a generic domain error without row context.
    const amountRaw = get(cols.amount);
    const amount = Number(amountRaw);
    if (amountRaw === "" || !Number.isFinite(amount) || amount <= 0) {
      throw new CsvImportError(`Row ${line}: invalid amount "${amountRaw}"`);
    }

    const currency = get(cols.currency) || defaultCurrency;
    const categoryRaw = get(cols.category);
    const dateRaw = get(cols.date);

    // Foreign-currency rows must carry their base-currency equivalent (we never
    // guess a rate), mirroring the single-entry API. Base-currency rows leave
    // the base amount undefined so the entity defaults it to the amount.
    let baseAmountMinor: number | undefined;
    let baseCurrency: string | undefined;
    if (currency !== defaultCurrency) {
      const baseRaw = get(cols.baseAmount);
      if (baseRaw === "") {
        throw new CsvImportError(
          `Row ${line}: a base amount (column "base_amount") is required for ${currency} entries`,
        );
      }
      const baseMajor = Number(baseRaw);
      if (!Number.isFinite(baseMajor) || baseMajor <= 0) {
        throw new CsvImportError(`Row ${line}: invalid base amount "${baseRaw}"`);
      }
      const baseCurrencyRaw = get(cols.baseCurrency);
      if (baseCurrencyRaw !== "" && baseCurrencyRaw !== defaultCurrency) {
        throw new CsvImportError(
          `Row ${line}: base currency "${baseCurrencyRaw}" does not match this ledger's base currency "${defaultCurrency}"`,
        );
      }
      baseCurrency = defaultCurrency;
      try {
        baseAmountMinor = Money.ofMajor(baseMajor, baseCurrency).amount;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new CsvImportError(`Row ${line}: ${message}`);
      }
    }

    let occurredAt: Date | undefined;
    if (dateRaw !== "") {
      const parsed = new Date(dateRaw);
      if (Number.isNaN(parsed.getTime())) {
        throw new CsvImportError(`Row ${line}: invalid date "${dateRaw}"`);
      }
      occurredAt = parsed;
    }

    try {
      records.push({
        type,
        amountMinor: Money.ofMajor(amount, currency).amount,
        currency,
        category:
          type === TransactionType.EXPENSE && categoryRaw !== ""
            ? toKakeiboCategory(categoryRaw)
            : undefined,
        occurredAt,
        note: get(cols.note),
        baseAmountMinor,
        baseCurrency,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CsvImportError(`Row ${line}: ${message}`);
    }
  }

  return records;
}
