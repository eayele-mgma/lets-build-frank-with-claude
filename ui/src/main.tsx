import "@cloudscape-design/global-styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, pageFromHash } from "./App";
import { createFrankClient } from "./frank/client";

// Mounts App with the real MCP client. Tests mount App with a fake one.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App client={createFrankClient()} initialPage={pageFromHash(window.location.hash)} />
  </StrictMode>,
);
