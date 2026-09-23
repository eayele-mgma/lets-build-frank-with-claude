# Frank's console

React 18 + TypeScript + Vite + Cloudscape
([ADR-003](../docs/adr/ADR-003-cloudscape-ui.md)). Frank serves the built
console at `/` from the same container, and the console calls `/mcp`
relatively, so there's no build-time URL and no CORS
([ADR-006](../docs/adr/ADR-006-classroom-credentials.md)).

## Run it

```bash
# terminal 1: Frank
cd server && npm run dev          # http://localhost:3000

# terminal 2: the console, with /mcp proxied to Frank
cd ui && npm install && npm run dev   # http://localhost:5173

npm test        # type-check, then vitest (jsdom)
npm run build   # dist/, which the root Dockerfile copies to Frank's public/
```

## Pages

- **Overview**: `get_status`, shown as connection state, version, uptime and greeting.
- **Tools**: every tool from MCP discovery. Select one and a form is generated
  from its input schema. Run it to see the summary and JSON result. A new tool
  on the server shows up here with no console changes.

## Layout

```
src/
  main.tsx            mounts App with the real MCP client
  App.tsx             AppLayout + SideNavigation; props: client, initialPage
  frank/client.ts     createFrankClient(): the only code that talks MCP
  frank/schema.ts     JSON Schema -> form fields -> tool arguments
  pages/Overview.tsx
  pages/Tools.tsx
  pages/ToolRunner.tsx  the schema-driven form and result
test/
  pages.test.tsx      App rendered with a fake FrankClient
  schema.test.ts
```

Pages depend on the `FrankClient` interface, not the SDK, which is how tests
render them with a fake client.

The console holds **no secrets**. It can only reach what Frank exposes, and
Frank is read-only (ADR-002).
