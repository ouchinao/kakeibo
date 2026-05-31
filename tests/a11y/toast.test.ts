import { describe, expect, test } from "bun:test";
import { withStaticDocument } from "../support/a11y.ts";

describe("toast accessibility", () => {
  test("the toast is an assertive-friendly live region so messages are announced", async () => {
    const attrs = await withStaticDocument((doc) => {
      const toast = doc.getElementById("toast");
      return {
        role: toast?.getAttribute("role"),
        ariaLive: toast?.getAttribute("aria-live"),
      };
    });
    expect(attrs.role).toBe("status");
    expect(attrs.ariaLive).toBe("polite");
  });
});
