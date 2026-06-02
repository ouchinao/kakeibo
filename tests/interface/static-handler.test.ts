import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticHandler } from "../../src/interface/http/static.ts";

const WEB_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "interface",
  "web",
);

describe("createStaticHandler", () => {
  const serve = createStaticHandler(WEB_ROOT);

  test("serves index.html for the root path", async () => {
    const res = await serve("/");
    expect(res).not.toBeNull();
    expect(res?.headers.get("content-type")).toContain("text/html");
  });

  test("serves a known asset with the right content type", async () => {
    const res = await serve("/app.js");
    expect(res?.headers.get("content-type")).toContain("text/javascript");
  });

  test("returns null for a missing asset", async () => {
    expect(await serve("/does-not-exist.js")).toBeNull();
  });

  test.each([
    "/../package.json",
    "/../../etc/passwd",
    "/..%2f..%2fpackage.json".replace(/%2f/g, "/"),
  ])("blocks path traversal attempt %p", async (path) => {
    expect(await serve(path)).toBeNull();
  });
});
