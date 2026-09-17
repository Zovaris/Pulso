import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { CommandRow } from "@/features/popover/components/CommandRow";
import type { DetectedCommand, Execution } from "@/lib/types";
import * as executionsApi from "@/services/api/executions";

vi.mock("@/services/api/executions", () => ({
  listExecutions: vi.fn(),
  startCommand: vi.fn(),
  stopExecution: vi.fn(),
  getLogSnapshot: vi.fn(),
  openDetectedUrl: vi.fn(),
}));

const api = vi.mocked(executionsApi);

const command: DetectedCommand = {
  id: "package.json:dev",
  label: "dev",
  program: "bun",
  args: ["run", "dev"],
  cwd: "/tmp/project",
  source: "package.json",
  detector: "packageJson",
  category: "dev",
  longRunning: true,
};

function execution(overrides: Partial<Execution> = {}): Execution {
  return {
    id: 7,
    projectId: 1,
    commandId: "package.json:dev",
    label: "dev",
    program: "bun",
    args: ["run", "dev"],
    cwd: "/tmp/project",
    state: "running",
    pid: 900,
    startedAt: Date.now() - 65_000,
    endedAt: null,
    exitCode: null,
    detail: null,
    restartedFrom: null,
    ports: [],
    ...overrides,
  };
}

beforeEach(() => {
  useStore.setState({
    locale: "en",
    executions: [],
    logs: {},
    openLogKey: null,
    pendingCommandId: null,
    projectError: null,
  });
});

describe("CommandRow", () => {
  it("offers to run a command that is idle", () => {
    render(<CommandRow projectId={1} command={command} />);

    expect(screen.getByText("dev")).toBeTruthy();
    expect(screen.getByText("bun run dev")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("shows the clock and the port while it runs", () => {
    useStore.setState({
      executions: [
        execution({
          ports: [
            { id: "log:4321", port: 4321, url: "http://localhost:4321/" },
          ],
        }),
      ],
    });

    render(<CommandRow projectId={1} command={command} />);

    expect(screen.getByText(/^1:0[45]$/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open http://localhost:4321/" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
  });

  it("stops the execution it is showing", () => {
    useStore.setState({ executions: [execution()] });
    render(<CommandRow projectId={1} command={command} />);

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(api.stopExecution).toHaveBeenCalledWith(7);
  });

  it("opens its output when the row is clicked", () => {
    render(<CommandRow projectId={1} command={command} />);

    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(useStore.getState().openLogKey).toBe("1:package.json:dev");
  });

  it("keeps the whole failure reason, wrapped over two lines", () => {
    const detail =
      "bun run lint exited with code 1. PATH: /Users/example/.bun/bin:/usr/bin";
    useStore.setState({
      executions: [execution({ state: "failed", exitCode: 1, detail })],
    });

    render(<CommandRow projectId={1} command={command} />);

    const line = screen.getByText(/exited with code 1/);
    expect(line.getAttribute("title")).toBe(detail);
    expect(line.className).toContain("line-clamp-2");
    expect(screen.getByRole("button", { name: "Run" })).toBeTruthy();
  });
});
