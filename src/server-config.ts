/**
 * Server configuration resolved from environment variables.
 *
 * Kept as a pure function (no I/O, no `process` access) so it is trivially
 * testable and the entry point stays a thin wrapper.
 */
export interface ServerConfig {
  /** TCP port to listen on. */
  readonly port: number;
  /**
   * Address to bind to. Defaults to loopback (`127.0.0.1`) so this
   * privacy-first, unauthenticated app is not exposed to the local network.
   * Set `HOST=0.0.0.0` to intentionally opt into LAN access.
   */
  readonly hostname: string;
  /** SQLite file path, or ":memory:" for an ephemeral database. */
  readonly databasePath: string;
  /** ISO 4217 code used when a request omits a currency. */
  readonly defaultCurrency: string;
}

type Env = Record<string, string | undefined>;

/** Builds the {@link ServerConfig} from an environment map. */
export function loadServerConfig(env: Env): ServerConfig {
  const port = Number(env.PORT);
  return {
    // Fall back when PORT is missing, empty, or not a positive integer.
    port: Number.isInteger(port) && port > 0 ? port : 3000,
    // Use `||` (not `??`) so an empty/whitespace HOST cannot silently bind to
    // all interfaces — it falls back to loopback just like an unset value.
    hostname: env.HOST?.trim() || "127.0.0.1",
    databasePath: env.DATABASE_PATH?.trim() || "./data/kakeibo.sqlite",
    defaultCurrency: env.DEFAULT_CURRENCY?.trim() || "JPY",
  };
}
