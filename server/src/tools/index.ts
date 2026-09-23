import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
import { registerGetStatus } from "./get_status.js";

// Every tool is registered here and nowhere else. Conventions (ADR-002, and
// .claude/skills/frank-tools): verb_noun names from get/list/search/summarize,
// strict zod inputs, summary-plus-typed-fields outputs, read-only.
export function registerTools(server: McpServer, ctx: ToolContext): void {
  registerGetStatus(server, ctx);
}

export type { ToolContext } from "./context.js";
