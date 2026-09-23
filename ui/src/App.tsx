import AppLayout from "@cloudscape-design/components/app-layout";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import { useState } from "react";
import type { FrankClient } from "./frank/client";
import { Overview } from "./pages/Overview";
import { Tools } from "./pages/Tools";

export type PageId = "overview" | "tools";

export interface AppProps {
  client: FrankClient;
  initialPage?: PageId;
}

const PAGES: Record<string, PageId> = { "#overview": "overview", "#tools": "tools" };

export function App({ client, initialPage = "overview" }: AppProps) {
  const [page, setPage] = useState<PageId>(initialPage);

  return (
    <AppLayout
      navigationWidth={220}
      toolsHide
      navigation={
        <SideNavigation
          header={{ href: "#overview", text: "Frank" }}
          activeHref={`#${page}`}
          items={[
            { type: "link", text: "Overview", href: "#overview" },
            { type: "link", text: "Tools", href: "#tools" },
          ]}
          onFollow={(event) => {
            const next = PAGES[event.detail.href];
            if (next) {
              event.preventDefault();
              setPage(next);
              window.history.replaceState(null, "", event.detail.href);
            }
          }}
        />
      }
      content={page === "overview" ? <Overview client={client} /> : <Tools client={client} />}
    />
  );
}

export function pageFromHash(hash: string): PageId {
  return PAGES[hash] ?? "overview";
}
