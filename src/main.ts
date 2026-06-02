import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./composition.ts";
import { loadServerConfig } from "./server-config.ts";

/**
 * Process entry point.
 *
 * Reads configuration from the environment (see .env.example), wires the app
 * via the composition root, and serves the HTTP API + web UI with Bun.
 */
function main(): void {
  const config = loadServerConfig(process.env);

  // Ensure the directory for a file-backed database exists.
  if (config.databasePath !== ":memory:") {
    mkdirSync(dirname(config.databasePath), { recursive: true });
  }

  const app = createApp({
    databasePath: config.databasePath,
    defaultCurrency: config.defaultCurrency,
  });

  const server = Bun.serve({
    hostname: config.hostname,
    port: config.port,
    fetch: app.fetch,
  });

  console.log(`Kakeibo Engine listening on http://${server.hostname}:${server.port}`);

  const shutdown = (): void => {
    server.stop();
    app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
