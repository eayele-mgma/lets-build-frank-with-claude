import { describe, expect, it } from "vitest";
import { buildArguments, fieldsFromSchema, initialValues, type JsonSchema } from "../src/frank/schema";

const schema: JsonSchema = {
  type: "object",
  properties: {
    query: { type: "string", description: "What to search for" },
    limit: { type: "integer", default: 10 },
    ratio: { type: "number" },
    verbose: { type: "boolean" },
    region: { type: "string", enum: ["eastus", "westeurope"] },
    tags: { type: "object" },
  },
  required: ["query"],
  additionalProperties: false,
};

describe("fieldsFromSchema", () => {
  it("maps each property to a field of the right kind", () => {
    const fields = fieldsFromSchema(schema);
    expect(fields.map((f) => [f.name, f.kind, f.required])).toEqual([
      ["query", "string", true],
      ["limit", "integer", false],
      ["ratio", "number", false],
      ["verbose", "boolean", false],
      ["region", "enum", false],
      ["tags", "json", false],
    ]);
    expect(fields[0]!.description).toBe("What to search for");
    expect(fields[4]!.options).toEqual(["eastus", "westeurope"]);
  });

  it("returns no fields for a tool that takes no input", () => {
    expect(fieldsFromSchema({ type: "object", properties: {} })).toEqual([]);
    expect(fieldsFromSchema(undefined)).toEqual([]);
  });

  it("treats nullable types as their non-null type", () => {
    expect(fieldsFromSchema({ properties: { n: { type: ["null", "number"] } } })[0]!.kind).toBe("number");
  });
});

describe("initialValues", () => {
  it("uses schema defaults", () => {
    const values = initialValues(fieldsFromSchema(schema));
    expect(values).toMatchObject({ query: "", limit: "10", verbose: false });
  });
});

describe("buildArguments", () => {
  const fields = fieldsFromSchema(schema);
  const base = initialValues(fields);

  it("converts values and leaves out empty optional fields", () => {
    const result = buildArguments(fields, { ...base, query: " vms ", ratio: "0.5", tags: '{"env":"dev"}' });
    expect(result).toEqual({
      ok: true,
      args: { query: "vms", limit: 10, ratio: 0.5, verbose: false, tags: { env: "dev" } },
    });
  });

  it("reports every invalid field at once", () => {
    const result = buildArguments(fields, { ...base, limit: "2.5", ratio: "lots", tags: "{" });
    expect(result).toEqual({
      ok: false,
      errors: {
        query: "query is required.",
        limit: "limit must be a whole number.",
        ratio: "ratio must be a number.",
        tags: "tags must be valid JSON.",
      },
    });
  });

  it("returns empty args for a tool with no input", () => {
    expect(buildArguments([], {})).toEqual({ ok: true, args: {} });
  });
});
