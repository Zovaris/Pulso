import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { catalogRows } from "@/features/desktop/catalog";
import type { CommandScan, Execution, Project } from "@/lib/types";
import { launchRows, OverviewSection } from "./OverviewSection";

const api: Project = {
  id: 1,
  name: "api",
  path: "/p/api",
  availability: "available",
};
const scan: CommandScan = {
  projectId: 1,
  status: "detected",
  detail: null,
  commands: ["dev", "test", "lint", "build"].map((label) => ({
    id: `package_json:${label}`,
    label,
    program: "bun",
    args: ["run", label],
    cwd: "/p/api",
    source: "package.json",
    detector: "package_json",
    category: "other" as const,
    longRunning: false,
  })),
  flags: { "package_json:lint": { favorite: true, hidden: false } },
};
const run = (overrides: Partial<Execution>): Execution => ({
  id: 1,
  projectId: 1,
  commandId: "package_json:dev",
  label: "dev",
  program: "bun",
  args: ["run", "dev"],
  cwd: "/p",
  state: "running",
  pid: 10,
  startedAt: 1_000,
  endedAt: null,
  exitCode: null,
  detail: null,
  restartedFrom: null,
  ports: [],
  ...overrides,
});

beforeEach(() => {
  useStore.setState({
    locale: "en",
    projects: [api],
    scans: { "1": scan },
    customCommands: [],
    executions: [],
    metrics: {},
    seenFailuresAt: 0,
  });
});

describe("launchRows", () => {
  it("puts starred commands first, then the latest distinct runs", () => {
    const rows = catalogRows([api], { "1": scan }, [], "Personal");
    const done = { state: "exited" as const, endedAt: 9, exitCode: 0 };
    const executions = [
      run({ id: 1, commandId: "package_json:test", startedAt: 1, ...done }),
      run({ id: 2, commandId: "package_json:build", startedAt: 3, ...done }),
      run({ id: 3, commandId: "package_json:test", startedAt: 2, ...done }),
      run({ id: 4, commandId: "package_json:lint", startedAt: 4, ...done }),
    ];

    expect(
      launchRows(rows, executions).map((row) => row.command.label),
    ).toEqual(["lint", "build", "test"]);
  });

  it("leaves out what is already running", () => {
    const rows = catalogRows([api], { "1": scan }, [], "Personal");

    expect(
      launchRows(rows, [run({ commandId: "package_json:lint" })]).map(
        (row) => row.command.label,
      ),
    ).toEqual([]);
  });
});

describe("OverviewSection", () => {
  it("welcomes a first run with one way forward", () => {
    useStore.setState({ projects: [], scans: {} });
    render(<OverviewSection />);

    expect(screen.getByText("Add your first project")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Add/ })).toBeTruthy();
  });

  it("raises an unseen failure until it is dismissed", () => {
    const markFailuresSeen = vi.fn(() =>
      useStore.setState({ seenFailuresAt: Date.now() }),
    );
    useStore.setState({
      executions: [
        run({
          commandId: "package_json:test",
          label: "test",
          state: "failed",
          endedAt: 5_000,
          exitCode: 2,
        }),
      ],
      markFailuresSeen,
    });
    render(<OverviewSection />);

    expect(screen.getByText("failed with code 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(markFailuresSeen).toHaveBeenCalled();
    expect(screen.queryByText("Needs attention")).toBeNull();
  });

  it("states real totals and never draws a chart it does not have", () => {
    useStore.setState({
      executions: [
        run({ ports: [{ id: "p", port: 3000, url: "http://localhost:3000" }] }),
      ],
      metrics: {
        1: { executionId: 1, cpu: 2.5, memory: 64 * 1024 * 1024, processes: 1 },
      },
    });
    const { container } = render(<OverviewSection />);

    expect(screen.getByText("1 running")).toBeTruthy();
    expect(screen.getByText("2.5% CPU")).toBeTruthy();
    expect(screen.getAllByText("64.0 MB")).toHaveLength(2);
    expect(container.querySelector("svg polyline")).toBeNull();
  });
});
