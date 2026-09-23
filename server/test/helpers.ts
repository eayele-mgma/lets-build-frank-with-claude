import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp, type AppOptions } from "../src/app.js";
import type { Config } from "../src/config.js";

export const TEST_VERSION = "9.9.9-test";

export interface RunningFrank {
  url: string;
  close: () => Promise<void>;
}

/** Boots Frank on an ephemeral port. */
export async function startFrank(overrides: Partial<Config> = {}, options: AppOptions = {}): Promise<RunningFrank> {
  const config: Config = { port: 0, version: TEST_VERSION, publicDir: join(tmpdir(), "frank-no-console"), ...overrides };
  const server = createApp(config, options).listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

/** A real MCP client connected over Streamable HTTP. */
export async function connectClient(baseUrl: string): Promise<Client> {
  const client = new Client({ name: "frank-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", baseUrl)));
  return client;
}

export function tempDir(): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), "frank-test-"));
  return { path, cleanup: () => rmSync(path, { recursive: true, force: true }) };
}

/** Headers a Streamable HTTP client must send on POST /mcp. */
export const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};
