import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const INDEX_HTML = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "interface",
  "web",
  "index.html",
);

export interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: number;
}

/**
 * Runs axe-core against the **static** web UI markup in a happy-dom document.
 *
 * External scripts are not executed (happy-dom does not run them by default),
 * so this audits the server-rendered HTML: forms, labels, landmarks, table
 * headers, the toast container, etc. Dynamic, JS-rendered fragments are out of
 * scope here.
 *
 * Note: axe's `color-contrast` rule needs real layout, which happy-dom does not
 * provide, so it is disabled to avoid false "incomplete" noise.
 */
export async function auditStaticPage(): Promise<AxeViolation[]> {
  GlobalRegistrator.register();
  try {
    // happy-dom registers `document` on the global scope at runtime; reach it
    // via globalThis (typed loosely) so the project keeps its non-DOM lib.
    const doc = (globalThis as unknown as { document: any }).document;

    const html = readFileSync(INDEX_HTML, "utf8");
    // Move everything inside <html> into the document, preserving the lang
    // attribute (stripping the <html> tag would otherwise drop it).
    const lang = /<html[^>]*\blang="([^"]+)"/i.exec(html)?.[1];
    doc.documentElement.innerHTML = html
      .replace(/<!doctype html>/i, "")
      .replace(/<\/?html[^>]*>/gi, "");
    if (lang) doc.documentElement.setAttribute("lang", lang);

    // axe-core is a browser bundle; import it only after globals are registered.
    const axe = (await import("axe-core")).default;
    const results = await axe.run(doc, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      nodes: v.nodes.length,
    }));
  } finally {
    GlobalRegistrator.unregister();
  }
}

/**
 * Loads the static web UI markup into a happy-dom document and invokes `fn`
 * with it, for assertions that aren't expressible as axe rules (e.g. live
 * regions). The document is torn down afterwards.
 */
export async function withStaticDocument<T>(fn: (doc: any) => T): Promise<T> {
  GlobalRegistrator.register();
  try {
    const doc = (globalThis as unknown as { document: any }).document;
    const html = readFileSync(INDEX_HTML, "utf8");
    doc.documentElement.innerHTML = html
      .replace(/<!doctype html>/i, "")
      .replace(/<\/?html[^>]*>/gi, "");
    return fn(doc);
  } finally {
    GlobalRegistrator.unregister();
  }
}
