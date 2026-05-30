import { join, normalize } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

/**
 * Builds a static-asset handler rooted at `webRoot`.
 *
 * Resolves "/" to index.html and guards against path traversal so the handler
 * can only ever serve files inside the web root.
 */
export function createStaticHandler(
  webRoot: string,
): (pathname: string) => Promise<Response | null> {
  const root = normalize(webRoot);

  return async function serve(pathname: string): Promise<Response | null> {
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const resolved = normalize(join(root, relative));

    // Reject anything that escapes the web root.
    if (!resolved.startsWith(root)) return null;

    const file = Bun.file(resolved);
    if (!(await file.exists())) return null;

    const ext = resolved.slice(resolved.lastIndexOf("."));
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    return new Response(file, { headers: { "content-type": contentType } });
  };
}
