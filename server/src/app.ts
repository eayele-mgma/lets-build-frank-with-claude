import { existsSync } from "node:fs";
import { join } from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type ErrorRequestHandler, type Response } from "express";
import type { Config } from "./config.js";
import { buildMcpServer } from "./mcp.js";
import type { ToolContext } from "./tools/index.js";

/** Largest JSON-RPC body Frank will parse. Tool inputs are small; raise it if a tool ever needs more. */
export const MCP_BODY_LIMIT = "1mb";

export interface AppOptions {
  /** Injectable clock for tests. */
  now?: () => number;
}

/**
 * Frank's HTTP surface (ADR-001, ADR-006):
 *   POST /mcp     MCP over Streamable HTTP, stateless
 *   GET  /healthz 200 for container probes
 *   GET  /        the Cloudscape console, if one was built into publicDir
 *
 * Returns the app without listening, so tests can bind it to port 0.
 */
export function createApp(config: Config, options: AppOptions = {}): express.Express {
  const now = options.now ?? Date.now;
  const ctx: ToolContext = { version: config.version, startedAt: now(), now };
  const uptimeSeconds = () => Math.max(0, Math.floor((now() - ctx.startedAt) / 1000));

  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok", version: config.version, uptimeSeconds: uptimeSeconds() });
  });

  // Stateless Streamable HTTP: a fresh server and transport per request, so
  // there are no sessions to store and any number of clients can call one
  // Frank concurrently. This is the SDK's documented stateless pattern; the
  // tools are request/response only, so nothing needs a long-lived stream.
  app.post("/mcp", express.json({ limit: MCP_BODY_LIMIT }), async (req, res, next) => {
    const server = buildMcpServer(ctx);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      // Plain JSON responses instead of SSE: same protocol, easier to read in curl.
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, withDefaultToolArguments(req.body));
    } catch (err) {
      next(err);
    }
  });

  // Stateless means no server-to-client stream (GET) and no session to end
  // (DELETE). The SDK client treats a 405 on GET as "no notifications".
  app.all("/mcp", (_req, res) => {
    res.set("Allow", "POST");
    jsonRpcError(res, 405, -32000, "Method not allowed. Frank speaks MCP over POST /mcp.");
  });

  // The console is optional (ADR-003): the Dockerfile always creates
  // publicDir, but leaves it empty until ui/ exists. So check for the
  // console's index.html, not for the directory.
  if (existsSync(join(config.publicDir, "index.html"))) {
    app.use(express.static(config.publicDir, { index: "index.html" }));
  } else {
    app.get("/", (_req, res) => {
      res
        .type("text/plain")
        .send(
          `Frank v${config.version} is running, but no console has been built into this image yet (ADR-003).\n` +
            "MCP is live at POST /mcp and health at GET /healthz.\n",
        );
    });
  }

  app.use(errorHandler);
  return app;
}

// MCP makes `arguments` optional on tools/call, but a strict zod object
// rejects `undefined`. Normalising here keeps every tool's schema strict
// (ADR-002) while accepting clients that omit arguments for no-input tools.
function withDefaultToolArguments(body: unknown): unknown {
  const messages = Array.isArray(body) ? body : [body];
  for (const msg of messages) {
    if (msg && typeof msg === "object" && (msg as { method?: unknown }).method === "tools/call") {
      const params = (msg as { params?: Record<string, unknown> }).params;
      if (params && typeof params === "object" && params.arguments === undefined) params.arguments = {};
    }
  }
  return body;
}

export function jsonRpcError(res: Response, httpStatus: number, code: number, message: string): void {
  res.status(httpStatus).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

// Express's default handler answers with an HTML page. MCP clients expect
// JSON-RPC, and ADR-002 forbids stack traces, so every error ends here.
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const type = (err as { type?: string } | undefined)?.type;
  let status = 500;
  let code = -32603;
  let message = "Frank hit an internal error.";
  if (type === "entity.parse.failed") {
    status = 400;
    code = -32700;
    message = "Parse error: the request body is not valid JSON.";
  } else if (type === "entity.too.large") {
    status = 413;
    code = -32600;
    message = `Request body is larger than Frank accepts (${MCP_BODY_LIMIT}).`;
  } else {
    console.error("[frank] unhandled error:", err);
  }

  if (res.headersSent) {
    res.end();
    return;
  }
  if (req.path === "/mcp") {
    jsonRpcError(res, status, code, message);
  } else {
    res.status(status).type("text/plain").send(message);
  }
};
