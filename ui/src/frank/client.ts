import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { JsonSchema } from "./schema";

export interface ToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
}

export interface ToolCallOutcome {
  isError: boolean;
  /** The text content blocks, joined. For an error, the plain-language message. */
  text: string;
  structured?: Record<string, unknown>;
}

export interface FrankStatus {
  summary: string;
  version: string;
  uptimeSeconds: number;
  greeting: string;
}

/** Everything the console needs from Frank. Pages depend on this, not on the SDK. */
export interface FrankClient {
  getStatus(): Promise<FrankStatus>;
  listTools(): Promise<ToolInfo[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallOutcome>;
}

/**
 * The real client. The console is served by Frank himself (ADR-006), so the
 * endpoint is relative: no build-time URL, no CORS. `npm run dev` proxies
 * /mcp to a local Frank (vite.config.ts).
 */
export function createFrankClient(options: { endpoint?: string } = {}): FrankClient {
  const endpoint = new URL(options.endpoint ?? "/mcp", window.location.href);
  let connection: Promise<Client> | undefined;

  function connect(): Promise<Client> {
    connection ??= (async () => {
      const client = new Client({ name: "frank-console", version: "0.1.0" });
      await client.connect(new StreamableHTTPClientTransport(endpoint));
      return client;
    })();
    return connection;
  }

  // Tool failures come back as results, not exceptions, so anything thrown is
  // a transport problem. Forget the connection so the next call reconnects,
  // e.g. after Frank scaled to zero and came back.
  async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    try {
      return await fn(await connect());
    } catch (err) {
      connection = undefined;
      throw err;
    }
  }

  const callTool = (name: string, args: Record<string, unknown>) =>
    withClient(async (client) => {
      const result = await client.callTool({ name, arguments: args });
      const blocks = (result.content ?? []) as Array<{ type: string; text?: string }>;
      return {
        isError: result.isError === true,
        text: blocks
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n"),
        structured: result.structuredContent as Record<string, unknown> | undefined,
      };
    });

  return {
    async getStatus() {
      const outcome = await callTool("get_status", {});
      if (outcome.isError || !outcome.structured) {
        throw new Error(outcome.text || "get_status returned no status.");
      }
      return outcome.structured as unknown as FrankStatus;
    },
    listTools: () =>
      withClient(async (client) => {
        const { tools } = await client.listTools();
        return tools.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema as JsonSchema,
        }));
      }),
    callTool,
  };
}
