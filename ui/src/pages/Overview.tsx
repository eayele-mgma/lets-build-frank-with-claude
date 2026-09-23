import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FrankClient, FrankStatus } from "../frank/client";
import { errorMessage, formatUptime } from "../frank/errors";

type State =
  | { kind: "loading" }
  | { kind: "ok"; status: FrankStatus; checkedAt: Date }
  | { kind: "error"; message: string };

export function Overview({ client }: { client: FrankClient }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setState({ kind: "loading" });
    try {
      const status = await client.getStatus();
      if (request === latest.current) setState({ kind: "ok", status, checkedAt: new Date() });
    } catch (err) {
      if (request === latest.current) setState({ kind: "error", message: errorMessage(err) });
    }
  }, [client]);

  useEffect(() => {
    void load();
    return () => {
      latest.current++;
    };
  }, [load]);

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Frank's own report, fetched live over MCP with get_status."
          actions={
            <Button iconName="refresh" loading={state.kind === "loading"} onClick={() => void load()}>
              Refresh
            </Button>
          }
        >
          Overview
        </Header>
      }
    >
      <Container header={<Header variant="h2">Status</Header>}>
        {state.kind === "loading" && <StatusIndicator type="loading">Asking Frank…</StatusIndicator>}
        {state.kind === "error" && (
          <Alert type="error" header="Frank did not answer">
            {state.message}
          </Alert>
        )}
        {state.kind === "ok" && (
          <SpaceBetween size="l">
            <Box variant="p">{state.status.summary}</Box>
            <KeyValuePairs
              columns={2}
              items={[
                { label: "Connection", value: <StatusIndicator type="success">Connected</StatusIndicator> },
                { label: "Version", value: state.status.version },
                { label: "Uptime", value: formatUptime(state.status.uptimeSeconds) },
                { label: "Checked", value: state.checkedAt.toLocaleTimeString() },
                { label: "Greeting", value: state.status.greeting },
              ]}
            />
          </SpaceBetween>
        )}
      </Container>
    </ContentLayout>
  );
}
