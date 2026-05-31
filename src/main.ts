import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./composition.ts";

/**
 * Process entry point.
 *
 * Reads configuration from the environment (see .env.example), wires the app
 * via the composition root, and serves the HTTP API + web UI with Bun.
 */
function main(): void {
  const port = Number(process.env.PORT ?? 3000);
  const databasePath = process.env.DATABASE_PATH ?? "./data/kakeibo.sqlite";
  const defaultCurrency = process.env.DEFAULT_CURRENCY ?? "JPY";

  // Ensure the directory for a file-backed database exists.
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const app = createApp({ databasePath, defaultCurrency });

  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });

  // eslint-disable-next-line no-console
  console.log(`Kakeibo Engine listening on http://localhost:${server.port}`);

  const shutdown = (): void => {
    server.stop();
    app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
