/**
 * Minimal RFC 4180-style CSV reader/writer.
 *
 * Self-contained (no dependency) so the offline app stays dependency-light.
 * Handles quoted fields, escaped quotes (""), and embedded commas/newlines.
 */

/** Serialises a matrix of rows into a CSV string (fields are quoted as needed). */
export function stringifyCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeField).join(",")).join("\r\n");
}

function escapeField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Parses a CSV string into a matrix of rows. Blank trailing lines are ignored.
 * Throws on a malformed quoted field.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < text.length) {
    const char = text[i] as string;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        // After a closing quote only a delimiter, newline, or end-of-input is
        // valid; anything else means the quoting is malformed.
        const next = text[i];
        if (next !== undefined && next !== "," && next !== "\n") {
          throw new Error("Malformed CSV: unexpected text after a closing quote");
        }
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
    } else if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += char;
      i += 1;
    }
  }

  if (inQuotes) {
    throw new Error("Malformed CSV: unterminated quoted field");
  }

  // Flush the final field/row when the input does not end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully empty rows (e.g. a blank line at the end of file).
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
