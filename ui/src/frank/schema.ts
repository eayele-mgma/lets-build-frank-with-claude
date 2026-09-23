// Turns a tool's JSON Schema into form fields, and form values back into tool
// arguments. This is what makes a new tool appear in the console with no UI
// work (ADR-003).

export interface JsonSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  enum?: unknown[];
  default?: unknown;
  items?: JsonSchema;
}

export type FieldKind = "string" | "number" | "integer" | "boolean" | "enum" | "json";

export interface Field {
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  description?: string;
  options?: string[];
  defaultValue?: unknown;
}

export type FieldValue = string | boolean;

export function fieldsFromSchema(schema: JsonSchema | undefined): Field[] {
  const properties = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  return Object.entries(properties).map(([name, prop]) => ({
    name,
    label: prop.title ?? name,
    kind: kindOf(prop),
    required: required.has(name),
    description: prop.description,
    options: prop.enum?.map(String),
    defaultValue: prop.default,
  }));
}

function kindOf(prop: JsonSchema): FieldKind {
  if (prop.enum && prop.enum.every((v) => typeof v === "string")) return "enum";
  const type = Array.isArray(prop.type) ? prop.type.find((t) => t !== "null") : prop.type;
  if (type === "string" || type === "number" || type === "integer" || type === "boolean") return type;
  // Objects, arrays and anything else: edit as JSON.
  return "json";
}

export function initialValues(fields: Field[]): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const f of fields) {
    if (f.kind === "boolean") values[f.name] = f.defaultValue === true;
    else if (f.defaultValue === undefined) values[f.name] = "";
    else values[f.name] = f.kind === "json" ? JSON.stringify(f.defaultValue, null, 2) : String(f.defaultValue);
  }
  return values;
}

export type BuildResult = { ok: true; args: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

/** Validates and converts form values. Empty optional fields are left out. */
export function buildArguments(fields: Field[], values: Record<string, FieldValue>): BuildResult {
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const f of fields) {
    const raw = values[f.name];
    if (f.kind === "boolean") {
      args[f.name] = raw === true;
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") {
      if (f.required) errors[f.name] = `${f.label} is required.`;
      continue;
    }
    switch (f.kind) {
      case "number":
      case "integer": {
        const n = Number(text);
        if (!Number.isFinite(n)) errors[f.name] = `${f.label} must be a number.`;
        else if (f.kind === "integer" && !Number.isInteger(n)) errors[f.name] = `${f.label} must be a whole number.`;
        else args[f.name] = n;
        break;
      }
      case "json":
        try {
          args[f.name] = JSON.parse(text);
        } catch {
          errors[f.name] = `${f.label} must be valid JSON.`;
        }
        break;
      default:
        args[f.name] = text;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, args };
}
