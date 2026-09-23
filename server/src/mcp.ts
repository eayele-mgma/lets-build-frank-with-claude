import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools, type ToolContext } from "./tools/index.js";

/** A fresh MCP server with all of Frank's tools. Cheap; built per request. */
export function buildMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "frank", version: ctx.version });
  registerTools(server, ctx);
  return server;
}
