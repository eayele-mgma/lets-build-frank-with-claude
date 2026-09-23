import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FrankClient, ToolInfo } from "../frank/client";
import { errorMessage } from "../frank/errors";
import { ToolRunner } from "./ToolRunner";

export function Tools({ client }: { client: FrankClient }) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<ToolInfo>();
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError(undefined);
    try {
      const list = await client.listTools();
      if (request !== latest.current) return;
      setTools(list);
      setSelected((current) => list.find((t) => t.name === current?.name));
    } catch (err) {
      if (request === latest.current) setError(errorMessage(err));
    } finally {
      if (request === latest.current) setLoading(false);
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
        <Header variant="h1" description="Every tool Frank advertises over MCP. Select one to run it.">
          Tools
        </Header>
      }
    >
      <SpaceBetween size="l">
        {error && (
          <Alert type="error" header="Frank did not answer">
            {error}
          </Alert>
        )}
        <Table
          items={tools}
          loading={loading}
          loadingText="Discovering tools"
          trackBy="name"
          selectionType="single"
          selectedItems={selected ? [selected] : []}
          onSelectionChange={({ detail }) => setSelected(detail.selectedItems[0])}
          ariaLabels={{
            selectionGroupLabel: "Tools",
            itemSelectionLabel: (_, tool) => `Select ${tool.name}`,
          }}
          columnDefinitions={[
            { id: "name", header: "Name", cell: (t) => <Box variant="code">{t.name}</Box> },
            { id: "description", header: "Description", cell: (t) => t.description ?? "" },
          ]}
          header={
            <Header
              counter={loading ? undefined : `(${tools.length})`}
              actions={<Button iconName="refresh" ariaLabel="Refresh tools" onClick={() => void load()} />}
            >
              Available tools
            </Header>
          }
          empty={<Box textAlign="center">Frank advertises no tools.</Box>}
        />
        {selected && <ToolRunner key={selected.name} client={client} tool={selected} />}
      </SpaceBetween>
    </ContentLayout>
  );
}
