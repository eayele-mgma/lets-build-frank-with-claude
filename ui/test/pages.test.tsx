import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import type { FrankClient, FrankStatus, ToolInfo } from "../src/frank/client";

const status: FrankStatus = {
  summary: "Frank v1.2.3 is up and has been running for 2m 5s.",
  version: "1.2.3",
  uptimeSeconds: 125,
  greeting: "Hi, I'm Frank.",
};

const getStatus: ToolInfo = {
  name: "get_status",
  title: "Get Frank's status",
  description: "Returns Frank's version, uptime and a greeting.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

const searchThings: ToolInfo = {
  name: "search_things",
  description: "Searches things.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string", description: "Search text" }, limit: { type: "integer" } },
    required: ["query"],
  },
};

function fakeClient(overrides: Partial<FrankClient> = {}): FrankClient {
  return {
    getStatus: vi.fn(async () => status),
    listTools: vi.fn(async () => [getStatus, searchThings]),
    callTool: vi.fn(async () => ({ isError: false, text: "{}", structured: { summary: "Did it.", count: 2 } })),
    ...overrides,
  };
}

describe("Overview", () => {
  it("shows Frank's status from get_status", async () => {
    render(<App client={fakeClient()} />);
    expect(await screen.findByText(status.summary)).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText("2m 5s")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("says Frank did not answer when the call fails", async () => {
    const client = fakeClient({ getStatus: vi.fn(async () => Promise.reject(new Error("Failed to fetch"))) });
    render(<App client={client} />);
    expect(await screen.findByText("Frank did not answer")).toBeInTheDocument();
    expect(screen.getByText("Failed to fetch")).toBeInTheDocument();
  });

  it("asks again on Refresh", async () => {
    const client = fakeClient();
    render(<App client={client} />);
    await screen.findByText(status.summary);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(client.getStatus).toHaveBeenCalledTimes(2));
  });
});

describe("Tools", () => {
  it("lists the tools Frank advertises", async () => {
    render(<App client={fakeClient()} initialPage="tools" />);
    expect(await screen.findByText("get_status")).toBeInTheDocument();
    expect(screen.getByText("search_things")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("navigates from Overview to Tools", async () => {
    render(<App client={fakeClient()} />);
    await userEvent.click(screen.getByRole("link", { name: "Tools" }));
    expect(await screen.findByText("search_things")).toBeInTheDocument();
  });

  it("runs a no-input tool and shows its summary and JSON", async () => {
    const client = fakeClient();
    render(<App client={client} initialPage="tools" />);
    await userEvent.click(await screen.findByRole("radio", { name: "Select get_status" }));
    expect(screen.getByText("This tool takes no input.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Run get_status" }));
    expect(client.callTool).toHaveBeenCalledWith("get_status", {});
    expect(await screen.findByText("Did it.")).toBeInTheDocument();
    expect(screen.getByTestId("tool-result")).toHaveTextContent('"count": 2');
  });

  it("renders a form from the input schema and sends typed arguments", async () => {
    const client = fakeClient();
    render(<App client={client} initialPage="tools" />);
    await userEvent.click(await screen.findByRole("radio", { name: "Select search_things" }));

    const form = screen.getByRole("button", { name: "Run search_things" }).closest("form")!;
    await userEvent.type(within(form).getByLabelText(/query/), "vms");
    await userEvent.type(within(form).getByLabelText(/limit/), "5");
    await userEvent.click(within(form).getByRole("button", { name: "Run search_things" }));

    expect(client.callTool).toHaveBeenCalledWith("search_things", { query: "vms", limit: 5 });
  });

  it("blocks the call and explains when a required field is empty", async () => {
    const client = fakeClient();
    render(<App client={client} initialPage="tools" />);
    await userEvent.click(await screen.findByRole("radio", { name: "Select search_things" }));
    await userEvent.click(screen.getByRole("button", { name: "Run search_things" }));

    expect(await screen.findByText("query is required.")).toBeInTheDocument();
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it("shows a tool's own error message when it returns isError", async () => {
    const client = fakeClient({
      callTool: vi.fn(async () => ({ isError: true, text: "Frank cannot see that resource group." })),
    });
    render(<App client={client} initialPage="tools" />);
    await userEvent.click(await screen.findByRole("radio", { name: "Select get_status" }));
    await userEvent.click(screen.getByRole("button", { name: "Run get_status" }));

    expect(await screen.findByText("The tool returned an error")).toBeInTheDocument();
    expect(screen.getByText("Frank cannot see that resource group.")).toBeInTheDocument();
  });

  it("says Frank did not answer when discovery fails", async () => {
    const client = fakeClient({ listTools: vi.fn(async () => Promise.reject(new Error("HTTP 502"))) });
    render(<App client={client} initialPage="tools" />);
    expect(await screen.findByText("Frank did not answer")).toBeInTheDocument();
    expect(screen.getByText("HTTP 502")).toBeInTheDocument();
  });
});
