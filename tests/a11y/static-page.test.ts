import { describe, expect, test } from "bun:test";
import { auditStaticPage } from "../support/a11y.ts";

/**
 * Known accessibility debt on the static markup, each tracked by a GitHub
 * issue. Accessibility fixes should REMOVE the matching entry here (which fails
 * until the underlying axe violation is gone), ratcheting the debt to zero.
 *
 *   empty-table-header  -> #19 (empty actions column header)
 */
const KNOWN_DEBT = new Set(["empty-table-header"]);

describe("static web UI accessibility (axe-core)", () => {
  test("introduces no axe violations outside the tracked debt", async () => {
    const violations = await auditStaticPage();
    const unexpected = violations.filter((v) => !KNOWN_DEBT.has(v.id));
    expect(unexpected).toEqual([]);
  });

  test("does not regress the document language", async () => {
    const violations = await auditStaticPage();
    expect(violations.map((v) => v.id)).not.toContain("html-has-lang");
  });
});
