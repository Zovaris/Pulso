import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { AppShell } from "@/features/shell/AppShell";
import type { Execution, Project } from "@/lib/types";

vi.mock("@/services/api/history", () => ({
  listExecutionHistory: vi.fn().mockResolvedValue([]),
  readExecutionLog: vi.fn(),
  clearExecutionHistory: vi.fn(),
}));

const project: Project = {
  id: 1,
  name: "astro-portfolio",
  path: "/tmp/astro-portfolio",
  availability: "available",
};

const running: Execution = {
  id: 1,
  projectId: 1,
  commandId: "package_json:dev",
  label: "dev",
  program: "bun",
  args: ["run", "dev"],
  cwd: "/tmp/astro-portfolio",
  state: "running",
  pid: 4_812,
  startedAt: Date.now() - 5_000,
  endedAt: null,
  exitCode: null,
  detail: null,
  restartedFrom: null,
  ports: [{ id: "local", port: 4321, url: "http://localhost:4321/" }],
};

beforeEach(() => {
  useStore.setState({
    locale: "en",
    section: "overview",
    projects: [],
    scans: {},
    executions: [],
    logs: {},
    metrics: {},
    histories: {},
    history: [],
    historyProject: null,
    historyLog: null,
    editors: [],
    data: null,
    environment: null,
    environmentFor: null,
    selectedExecutionId: null,
    selectedProjectId: null,
    paletteOpen: false,
    confirmingStop: null,
    confirmingHistory: false,
  });
});

describe("AppShell", () => {
  it("draws the whole window before anything has been loaded", () => {
    render(<AppShell />);

    expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });

  it.each(["overview", "projects", "processes", "logs", "settings"] as const)(
    "draws the %s section empty",
    (section) => {
      useStore.setState({ section });

      render(<AppShell />);

      expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    },
  );

  it("draws it with a project, a scan and a run in flight", () => {
    useStore.setState({
      projects: [project],
      scans: {
        "1": {
          projectId: 1,
          commands: [
            {
              id: "package_json:dev",
              label: "dev",
              program: "bun",
              args: ["run", "dev"],
              cwd: "/tmp/astro-portfolio",
              source: "package.json",
              detector: "package_json",
              category: "dev",
              longRunning: true,
            },
          ],
          status: "detected",
          detail: null,
          flags: {},
        },
      },
      executions: [running],
      selectedProjectId: 1,
    });

    render(<AppShell />);

    expect(screen.getAllByText(/astro-portfolio/).length).toBeGreaterThan(0);
  });
});
