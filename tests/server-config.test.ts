import { describe, expect, test } from "bun:test";
import { loadServerConfig } from "../src/server-config.ts";

describe("loadServerConfig", () => {
  test("defaults to loopback host and sensible values when env is empty", () => {
    const config = loadServerConfig({});
    expect(config.hostname).toBe("127.0.0.1");
    expect(config.port).toBe(3000);
    expect(config.databasePath).toBe("./data/kakeibo.sqlite");
    expect(config.defaultCurrency).toBe("JPY");
  });

  test("does NOT bind to all interfaces by default", () => {
    expect(loadServerConfig({}).hostname).not.toBe("0.0.0.0");
  });

  test("honours explicit overrides (incl. opting into LAN exposure)", () => {
    const config = loadServerConfig({
      HOST: "0.0.0.0",
      PORT: "8080",
      DATABASE_PATH: ":memory:",
      DEFAULT_CURRENCY: "USD",
    });
    expect(config.hostname).toBe("0.0.0.0");
    expect(config.port).toBe(8080);
    expect(config.databasePath).toBe(":memory:");
    expect(config.defaultCurrency).toBe("USD");
  });

  test("treats an empty or whitespace HOST as the loopback default (security)", () => {
    expect(loadServerConfig({ HOST: "" }).hostname).toBe("127.0.0.1");
    expect(loadServerConfig({ HOST: "   " }).hostname).toBe("127.0.0.1");
  });

  test("falls back to the default port for an empty or invalid PORT", () => {
    expect(loadServerConfig({ PORT: "" }).port).toBe(3000);
    expect(loadServerConfig({ PORT: "not-a-number" }).port).toBe(3000);
  });
});
