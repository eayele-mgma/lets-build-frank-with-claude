# Frank's MCP server

TypeScript on Node 22, the official MCP SDK, Streamable HTTP over Express
([ADR-001](../docs/adr/ADR-001-mcp-server-stack.md)). Tools follow
[ADR-002](../docs/adr/ADR-002-mcp-tool-conventions.md).

| Route | What |
|---|---|
| `POST /mcp` | MCP over Streamable HTTP, stateless, JSON responses |
| `GET /healthz` | `200 {status, version, uptimeSeconds}` for probes |
| `GET /` | The Cloudscape console if one was built into `public/`, otherwise a note saying there isn't one yet |

## Run it

```bash
npm install
npm run dev            # tsx watch, http://localhost:3000
npm test               # type-check (src + tests), then vitest
npm run build && npm start
```

The production image is built from the **repository root** `Dockerfile`, not
from here, because it also bundles `ui/` (ADR-006).

## Talk to it

```bash
curl -s http://localhost:3000/healthz

curl -s http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_status"}}'

claude mcp add --transport http frank http://localhost:3000/mcp
```

Both `Accept` types are required by the Streamable HTTP spec, even though Frank
answers with plain JSON.

## Environment

All configuration is environment variables (ADR-001). No values live in files.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Listen port. Must match the Dockerfile and `deploy.yml`'s `--target-port`. |

`deploy.yml` also sets `AZURE_*` variables for ADR-009's tools. Nothing reads
them yet.

## Layout

```
src/
  index.ts        entry: load config, listen, handle SIGTERM
  config.ts       zod-validated env; fails at boot in plain language
  app.ts          createApp(config): routes, stateless MCP handler, error handler
  mcp.ts          buildMcpServer(): a fresh McpServer with every tool
  tools/
    index.ts      registerTools(): the one place tools are wired in
    get_status.ts one module per tool: strict zod input, output schema, handler
    result.ts     toolResult() / toolError(): ADR-002's output shape
test/
  conventions.test.ts  ADR-002 enforced for every registered tool
  mcp-http.test.ts     real SDK client over HTTP
  static-console.test.ts
  config.test.ts
```

## Adding a tool

Follow `.claude/skills/frank-tools/SKILL.md`: add `src/tools/<verb_noun>.ts`,
register it in `src/tools/index.ts`, and test it. `conventions.test.ts` fails
if the name, description, input schema or output shape breaks ADR-002.

Notes worth knowing:

- Input schemas must be `z.object({...}).strict()` so unknown fields are
  rejected. Don't add `.default()` to the object: the SDK then stops
  advertising `additionalProperties: false`. A missing `arguments` object is
  already normalised to `{}` in `app.ts`.
- Relative imports need a `.js` extension (`./tools/index.js`). `tsx` doesn't
  mind if you forget; `tsc` does, and `npm test` runs `tsc` so you find out
  before the Docker build.
- JSON bodies over 1 MB are refused (`MCP_BODY_LIMIT` in `app.ts`).
