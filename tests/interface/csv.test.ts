import { describe, expect, test } from "bun:test";
import { parseCsv, stringifyCsv } from "../../src/interface/http/csv.ts";

describe("CSV utilities", () => {
  test("stringifies plain rows", () => {
    expect(stringifyCsv([["a", "b"], ["1", "2"]])).toBe("a,b\r\n1,2");
  });

  test("quotes fields containing commas, quotes, and newlines", () => {
    const out = stringifyCsv([["he said \"hi\"", "a,b", "line1\nline2"]]);
    expect(out).toBe('"he said ""hi""","a,b","line1\nline2"');
  });

  test("parses plain CSV", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("parses quoted fields with embedded commas and quotes", () => {
    expect(parseCsv('"a,b","c""d"')).toEqual([["a,b", 'c"d']]);
  });

  test("round-trips through stringify and parse", () => {
    const rows = [
      ["date", "note"],
      ["2026-05-01", "groceries, fruit"],
      ["2026-05-02", 'said "hi"'],
    ];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });

  test("ignores a trailing blank line", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("throws on an unterminated quote", () => {
    expect(() => parseCsv('"unterminated')).toThrow();
  });
});
