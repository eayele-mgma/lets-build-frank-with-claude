import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    // Fail at boot, in plain language, rather than at the first request.
    console.error(err instanceof ConfigError ? `[frank] ${err.message}` : err);
    process.exit(1);
  }

  const server = createApp(config).listen(config.port, () => {
    console.log(`[frank] v${config.version} listening on port ${config.port}: MCP at POST /mcp, health at GET /healthz`);
  });

  // Container Apps sends SIGTERM when it scales Frank to zero.
  const shutdown = (signal: string) => {
    console.log(`[frank] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
