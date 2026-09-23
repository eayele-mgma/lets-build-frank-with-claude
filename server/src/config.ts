import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// This file is src/config.ts under `npm run dev` and dist/config.js once built.
// Both sit exactly one level below the package root, so resolving from here
// holds wherever the process was started — unlike process.cwd(). Moving this
// file to a different depth breaks that; test/config.test.ts will catch it.
export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Every setting is an environment variable (ADR-001). Later ADRs add theirs
// here. An empty string counts as unset, since that is what a blank
// `PORT=` line or an unset GitHub variable produces.
const blankIsUnset = (v: unknown) => (v === "" ? undefined : v);

const EnvSchema = z.object({
  PORT: z.preprocess(blankIsUnset, z.coerce.number().int().min(1).max(65535).default(3000)),
});

export interface Config {
  port: number;
  version: string;
  /** Where the built console lives. Served at `/` if it holds an index.html. */
  publicDir: string;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(
      `Frank's configuration is invalid (${problems}). Settings come from environment variables; see server/README.md.`,
    );
  }
  return {
    port: parsed.data.PORT,
    version: readVersion(),
    publicDir: join(packageRoot, "public"),
  };
}

function readVersion(): string {
  const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}
