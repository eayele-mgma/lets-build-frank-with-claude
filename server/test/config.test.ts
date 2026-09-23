import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, packageRoot } from "../src/config.js";

describe("loadConfig", () => {
  it("defaults PORT to 3000, matching the Dockerfile and deploy.yml's --target-port", () => {
    expect(loadConfig({}).port).toBe(3000);
  });

  it("reads PORT from the environment", () => {
    expect(loadConfig({ PORT: "8080" }).port).toBe(8080);
  });

  it("treats an empty PORT as unset", () => {
    expect(loadConfig({ PORT: "" }).port).toBe(3000);
  });

  it.each(["abc", "0", "70000", "3000.5"])("rejects PORT=%s with a plain-language error", (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: port })).toThrow(/configuration is invalid \(PORT:/);
  });

  it("takes the version from package.json", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as { version: string };
    expect(loadConfig({}).version).toBe(pkg.version);
  });
});

describe("packageRoot", () => {
  // The Dockerfile copies the console to <package root>/public. If config.ts
  // moves to a different depth, this is the test that notices.
  it("resolves to the server package, independent of the working directory", () => {
    expect(existsSync(join(packageRoot, "package.json"))).toBe(true);
    expect(existsSync(join(packageRoot, "src", "config.ts"))).toBe(true);
  });

  it("puts the console at <package root>/public", () => {
    expect(loadConfig({}).publicDir).toBe(join(packageRoot, "public"));
  });
});
