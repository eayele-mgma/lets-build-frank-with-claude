import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import { buildMcpServer } from "../src/mcp.js";

// ADR-002 enforced for every registered tool, so a new tool that breaks policy
// fails here rather than in review.
const VERBS = ["get", "list", "search", "summarize"] as const;
const NAME = new RegExp(`^(${VERBS.join("|")})_[a-z]+(_[a-z]+)*$`);

type Tool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];
let tools: Tool[];

beforeAll(async () => {
  const server = buildMcpServer({ version: "0.0.0", startedAt: 0, now: () => 0 });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "conventions", version: "0.0.0" });
  await client.connect(clientSide);
  ({ tools } = await client.listTools());
});

describe("tool conventions (ADR-002)", () => {
  it("has at least one tool", () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  it("names every tool verb_noun with a verb from the closed set", () => {
    for (const tool of tools) expect(tool.name, tool.name).toMatch(NAME);
  });

  it("describes every tool in one or two sentences", () => {
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
      const sentences = tool.description!.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, tool.name).toBeLessThanOrEqual(2);
    }
  });

  it("rejects unknown input fields on every tool", () => {
    for (const tool of tools) expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
  });

  it("describes every input parameter", () => {
    for (const tool of tools) {
      const props = (tool.inputSchema.properties ?? {}) as Record<string, { description?: string }>;
      for (const [param, schema] of Object.entries(props)) {
        expect(schema.description, `${tool.name}.${param}`).toBeTruthy();
      }
    }
  });

  it("declares an output schema with a top-level summary on every tool", () => {
    for (const tool of tools) {
      expect(tool.outputSchema?.properties, tool.name).toHaveProperty("summary");
      expect(tool.outputSchema?.required, tool.name).toContain("summary");
    }
  });

  it("marks every tool read-only", () => {
    for (const tool of tools) expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
  });
});
