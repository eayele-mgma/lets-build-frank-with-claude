import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useMemo, useState } from "react";
import type { FrankClient, ToolCallOutcome, ToolInfo } from "../frank/client";
import { errorMessage } from "../frank/errors";
import { buildArguments, fieldsFromSchema, initialValues, type Field, type FieldValue } from "../frank/schema";

type Run =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; outcome: ToolCallOutcome }
  | { kind: "failed"; message: string };

/** A form generated from the tool's input schema, and the result of running it. */
export function ToolRunner({ client, tool }: { client: FrankClient; tool: ToolInfo }) {
  const fields = useMemo(() => fieldsFromSchema(tool.inputSchema), [tool]);
  const [values, setValues] = useState(() => initialValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [run, setRun] = useState<Run>({ kind: "idle" });

  async function submit() {
    const built = buildArguments(fields, values);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    setRun({ kind: "running" });
    try {
      setRun({ kind: "done", outcome: await client.callTool(tool.name, built.args) });
    } catch (err) {
      setRun({ kind: "failed", message: errorMessage(err) });
    }
  }

  const setValue = (name: string, value: FieldValue) => setValues((v) => ({ ...v, [name]: value }));

  return (
    <Container header={<Header variant="h2" description={tool.description}>{tool.title ?? tool.name}</Header>}>
      <SpaceBetween size="l">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Form
            actions={
              <Button variant="primary" loading={run.kind === "running"}>
                Run {tool.name}
              </Button>
            }
          >
            {fields.length === 0 ? (
              <Box color="text-body-secondary">This tool takes no input.</Box>
            ) : (
              <SpaceBetween size="m">
                {fields.map((field) => (
                  <FieldInput
                    key={field.name}
                    field={field}
                    value={values[field.name]!}
                    error={errors[field.name]}
                    onChange={(v) => setValue(field.name, v)}
                  />
                ))}
              </SpaceBetween>
            )}
          </Form>
        </form>
        <Result run={run} />
      </SpaceBetween>
    </Container>
  );
}

function FieldInput(props: { field: Field; value: FieldValue; error?: string; onChange: (v: FieldValue) => void }) {
  const { field, value, error, onChange } = props;
  const common = {
    label: field.label,
    description: field.description,
    errorText: error,
    constraintText: field.required ? undefined : "Optional",
  };

  if (field.kind === "boolean") {
    return (
      <FormField {...common}>
        <Checkbox checked={value === true} onChange={({ detail }) => onChange(detail.checked)}>
          {field.label}
        </Checkbox>
      </FormField>
    );
  }
  const text = typeof value === "string" ? value : "";
  if (field.kind === "enum") {
    const options = (field.options ?? []).map((o) => ({ label: o, value: o }));
    return (
      <FormField {...common}>
        <Select
          selectedOption={options.find((o) => o.value === text) ?? null}
          options={options}
          placeholder="Choose a value"
          onChange={({ detail }) => onChange(detail.selectedOption.value ?? "")}
        />
      </FormField>
    );
  }
  if (field.kind === "json") {
    return (
      <FormField {...common} constraintText={field.required ? "JSON" : "Optional, JSON"}>
        <Textarea value={text} onChange={({ detail }) => onChange(detail.value)} rows={4} />
      </FormField>
    );
  }
  return (
    <FormField {...common}>
      <Input
        value={text}
        type={field.kind === "string" ? "text" : "number"}
        inputMode={field.kind === "integer" ? "numeric" : field.kind === "number" ? "decimal" : undefined}
        onChange={({ detail }) => onChange(detail.value)}
      />
    </FormField>
  );
}

function Result({ run }: { run: Run }) {
  if (run.kind === "failed") {
    return (
      <Alert type="error" header="Frank did not answer">
        {run.message}
      </Alert>
    );
  }
  if (run.kind !== "done") return null;

  const { outcome } = run;
  if (outcome.isError) {
    return (
      <Alert type="error" header="The tool returned an error">
        {outcome.text}
      </Alert>
    );
  }
  const summary = typeof outcome.structured?.summary === "string" ? outcome.structured.summary : undefined;
  return (
    <SpaceBetween size="s">
      <Header variant="h3">Result</Header>
      {summary && <Box variant="p">{summary}</Box>}
      <Box variant="code">
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }} data-testid="tool-result">
          {outcome.structured ? JSON.stringify(outcome.structured, null, 2) : outcome.text}
        </pre>
      </Box>
    </SpaceBetween>
  );
}
