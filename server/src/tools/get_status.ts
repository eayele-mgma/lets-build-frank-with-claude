import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./context.js";
import { toolError, toolResult } from "./result.js";

// .strict(): ADR-002 says unknown fields are rejected. A plain z.object()
// silently strips them instead. (A missing `arguments` object is normalised
// to {} in app.ts, so no .default() is needed; adding one here would drop
// additionalProperties:false from the advertised schema.)
export const inputSchema = z.object({}).strict();

export const outputSchema = z.object({
  summary: z.string().describe("One-line, human-readable status."),
  version: z.string().describe("Frank's server version."),
  uptimeSeconds: z.number().int().nonnegative().describe("Seconds since this Frank process started."),
  greeting: z.string().describe("A hello from Frank."),
});

export function registerGetStatus(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "get_status",
    {
      title: "Get Frank's status",
      description:
        "Returns Frank's version, how long he has been running, and a greeting. Use it to check that Frank is reachable and which build is deployed; it reports nothing about Azure.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const uptimeSeconds = Math.max(0, Math.floor((ctx.now() - ctx.startedAt) / 1000));
        return toolResult({
          summary: `Frank v${ctx.version} is up and has been running for ${formatUptime(uptimeSeconds)}.`,
          version: ctx.version,
          uptimeSeconds,
          greeting: "Hi, I'm Frank. Ask me about my world.",
        });
      } catch {
        return toolError("Frank could not work out his own status. Try again in a moment.");
      }
    },
  );
}

function formatUptime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
