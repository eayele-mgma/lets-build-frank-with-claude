import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectClient, MCP_HEADERS, startFrank, TEST_VERSION, type RunningFrank } from "./helpers.js";

let frank: RunningFrank;
let clock = 1_000_000;

beforeAll(async () => {
  frank = await startFrank({}, { now: () => clock });
});
afterAll(async () => {
  await frank.close();
});

describe("MCP over stateless Streamable HTTP", () => {
  // The load-bearing assumption of the transport design: `initialize` and the
  // calls after it are separate HTTP requests, each handled by a brand-new
  // server instance that never saw the handshake.
  it("completes the handshake, then lists and calls tools over separate requests", async () => {
    const client = await connectClient(frank.url);
    expect(client.getServerVersion()).toMatchObject({ name: "frank", version: TEST_VERSION });

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("get_status");

    const result = await client.callTool({ name: "get_status", arguments: {} });
    expect(result.isError).toBeFalsy();
    await client.close();
  });

  it("serves several clients at once", async () => {
    const clients = await Promise.all(Array.from({ length: 5 }, () => connectClient(frank.url)));
    const results = await Promise.all(clients.map((c) => c.callTool({ name: "get_status", arguments: {} })));
    expect(results.every((r) => !r.isError)).toBe(true);
    await Promise.all(clients.map((c) => c.close()));
  });

  it("calls get_status without any arguments object", async () => {
    const client = await connectClient(frank.url);
    const result = await client.callTool({ name: "get_status" });
    expect(result.isError).toBeFalsy();
    await client.close();
  });
});

describe("get_status", () => {
  it("returns a summary plus typed fields (ADR-002)", async () => {
    clock = 1_000_000;
    const frankWithClock = await startFrank({}, { now: () => clock });
    clock += 125_000;
    const client = await connectClient(frankWithClock.url);
    const result = await client.callTool({ name: "get_status", arguments: {} });

    expect(result.structuredContent).toEqual({
      summary: `Frank v${TEST_VERSION} is up and has been running for 2m 5s.`,
      version: TEST_VERSION,
      uptimeSeconds: 125,
      greeting: expect.any(String),
    });
    // Text content mirrors the structured content for text-only clients.
    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(first!.text)).toEqual(result.structuredContent);

    await client.close();
    await frankWithClock.close();
  });

  it("rejects unknown fields instead of silently dropping them (ADR-002)", async () => {
    const client = await connectClient(frank.url);
    const result = await client.callTool({ name: "get_status", arguments: { verbose: true } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/Input validation error/);
    expect(JSON.stringify(result.content)).not.toMatch(/\n\s+at /);
    await client.close();
  });
});

describe("unknown tools", () => {
  it("answer with a plain-language error", async () => {
    const client = await connectClient(frank.url);
    const result = await client.callTool({ name: "delete_everything", arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/not found/);
    await client.close();
  });
});

describe("HTTP edges of /mcp", () => {
  it.each(["GET", "DELETE"])("%s /mcp is 405 with Allow: POST", async (method) => {
    const res = await fetch(`${frank.url}/mcp`, { method });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(await res.json()).toMatchObject({ jsonrpc: "2.0", error: { code: -32000 } });
  });

  it("malformed JSON gets a JSON-RPC parse error, not an HTML stack trace", async () => {
    const res = await fetch(`${frank.url}/mcp`, { method: "POST", headers: MCP_HEADERS, body: "{not json" });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.text();
    expect(JSON.parse(body)).toMatchObject({ jsonrpc: "2.0", error: { code: -32700 }, id: null });
    expect(body).not.toMatch(/at .*\.(js|ts):\d+/);
  });

  it("an oversized body is refused before it reaches the MCP server", async () => {
    const huge = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: { pad: "x".repeat(1_100_000) } });
    const res = await fetch(`${frank.url}/mcp`, { method: "POST", headers: MCP_HEADERS, body: huge });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: { code: -32600 } });
  });

  it("answers a raw tools/list POST, the way curl would send it", async () => {
    const res = await fetch(`${frank.url}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
    expect(body.result.tools.map((t) => t.name)).toContain("get_status");
  });
});

describe("GET /healthz", () => {
  it("returns 200 with version and uptime", async () => {
    const res = await fetch(`${frank.url}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", version: TEST_VERSION, uptimeSeconds: expect.any(Number) });
  });
});
