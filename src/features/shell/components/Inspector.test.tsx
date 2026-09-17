import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import {
  ProcessInspector,
  ProjectInspector,
} from "@/features/shell/components/Inspector";
import type { Execution, HistoryEntry } from "@/lib/types";
import * as historyApi from "@/services/api/history";

vi.mock("@/services/api/history", () => ({
  listExecutionHistory: vi.fn(),
  readExecutionLog: vi.fn(),
  clearExecutionHistory: vi.fn(),
}));

const stored: HistoryEntry = {
  id: 4,
  projectId: 1,
  commandId: "package_json:dev",
  label: "dev",
  program: "bun",
  args: ["run", "dev"],
  cwd: "/tmp/one",
  state: "failed",
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_065_000,
  exitCode: 2,
  detail: null,
  lines: 8,
};

const project = {
  id: 1,
  name: "one",
  path: "/tmp/one",
  availability: "available" as const,
};

function execution(extra: Partial<Execution> = {}): Execution {
  return {
    id: 1,
    projectId: 1,
    commandId: "package_json:dev",
    label: "dev",
    program: "bun",
    args: ["run", "dev"],
    cwd: "/tmp/one",
    state: "exited",
    pid: 12,
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_002_000,
    exitCode: 0,
    detail: null,
    restartedFrom: null,
    ports: [],
    ...extra,
  };
}

beforeEach(() => {
  useStore.setState({
    locale: "en",
    executions: [],
    logs: {},
    metrics: {},
    histories: {},
    projects: [],
    scans: {},
    selectedExecutionId: null,
    selectedProjectId: null,
    history: [],
    historyProject: null,
    historyLog: null,
    environment: null,
    environmentFor: null,
    editors: [],
  });
});

describe("ProcessInspector", () => {
  it("holds up with nothing selected", () => {
    render(<ProcessInspector />);

    expect(
      screen.getByText("Pick a run and its details appear here."),
    ).toBeTruthy();
  });

  it("holds up when the output of the selected run has not arrived", () => {
    useStore.setState({
      executions: [execution()],
      selectedExecutionId: 1,
      logs: {},
    });

    render(<ProcessInspector />);

    expect(screen.getByText("Waiting for output…")).toBeTruthy();
  });
});

describe("ProjectInspector", () => {
  it("draws the timeline of a project that has never run", async () => {
    vi.mocked(historyApi.listExecutionHistory).mockResolvedValue([]);

    render(<ProjectInspector project={project} />);

    expect(await screen.findByText("Nothing has run yet.")).toBeTruthy();
  });

  it("shows a stored run with its exit code and duration", async () => {
    vi.mocked(historyApi.listExecutionHistory).mockResolvedValue([stored]);

    render(<ProjectInspector project={project} />);

    expect(await screen.findByText("2")).toBeTruthy();
    expect(screen.getByText("1:05")).toBeTruthy();
  });
});
