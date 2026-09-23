import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { connectClient, startFrank, tempDir, type RunningFrank } from "./helpers.js";

let frank: RunningFrank | undefined;
let dir: ReturnType<typeof tempDir> | undefined;

afterEach(async () => {
  await frank?.close();
  dir?.cleanup();
  frank = undefined;
  dir = undefined;
});

describe("with a built console", () => {
  async function bootWithConsole() {
    dir = tempDir();
    writeFileSync(join(dir.path, "index.html"), "<!doctype html><title>Frank</title><div id=root></div>");
    mkdirSync(join(dir.path, "assets"));
    writeFileSync(join(dir.path, "assets", "index-abc123.js"), "console.log('frank')");
    frank = await startFrank({ publicDir: dir.path });
    return frank;
  }

  it("serves the console at /", async () => {
    const { url } = await bootWithConsole();
    const res = await fetch(`${url}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>Frank</title>");
  });

  it("serves the console's assets", async () => {
    const { url } = await bootWithConsole();
    const res = await fetch(`${url}/assets/index-abc123.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("still answers POST /mcp over the real MCP client", async () => {
    const { url } = await bootWithConsole();
    const client = await connectClient(url);
    const result = await client.callTool({ name: "get_status", arguments: {} });
    expect(result.isError).toBeFalsy();
    await client.close();
  });

  it("still answers /healthz", async () => {
    const { url } = await bootWithConsole();
    expect((await fetch(`${url}/healthz`)).status).toBe(200);
  });
});

describe("without a console (ADR-003: it is built late)", () => {
  // What the Docker image looks like before ui/ exists: the Dockerfile always
  // creates public/, it is just empty. Gating on the directory would 404 here.
  it("says so at / when public/ exists but is empty", async () => {
    dir = tempDir();
    frank = await startFrank({ publicDir: dir.path });
    const res = await fetch(`${frank.url}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/no console has been built/);
  });

  it("says so at / when public/ does not exist at all", async () => {
    dir = tempDir();
    frank = await startFrank({ publicDir: join(dir.path, "missing") });
    const res = await fetch(`${frank.url}/`);
    expect(await res.text()).toMatch(/no console has been built/);
  });
});
