import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ADR-002's output shape: a top-level `summary` plus typed detail fields,
// returned both as structured content and as text for clients that only read
// text.
export function toolResult<T extends { summary: string }>(fields: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(fields, null, 2) }],
    structuredContent: fields,
  };
}

// ADR-002: errors are plain language with `isError: true`, never a stack trace.
export function toolError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
