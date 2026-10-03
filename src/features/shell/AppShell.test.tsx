import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { AppShell } from "@/features/shell/AppShell";
import en from "@/lib/i18n/locales/en/common.json";
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
    sidebarOpen: true,
    inspectorOpen: true,
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

  it.each([
    "overview",
    "projects",
    "processes",
    "logs",
    "settings",
    "ports",
  ] as const)("draws the %s section empty", (section) => {
    useStore.setState({ section });

    render(<AppShell />);

    expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
  });

  it("bounds the shell and main pane so only section content can scroll", () => {
    const { container } = render(<AppShell />);
    const shell = container.querySelector(".pulso-window");
    const main = screen.getByRole("main");
    expect(shell?.classList.contains("overflow-hidden")).toBe(true);
    expect(main.classList.contains("overflow-hidden")).toBe(true);
    expect(main.classList.contains("min-h-0")).toBe(true);
    expect(main.parentElement?.classList.contains("overflow-hidden")).toBe(
      true,
    );
  });

  it("closes the section rail from the titlebar alone", () => {
    const { container } = render(<AppShell />);
    const shell = container.querySelector("[data-sidebar]");

    expect(screen.getAllByTitle(en.hideSidebar)).toHaveLength(1);
    expect(screen.getAllByTitle(en.hideInspector)).toHaveLength(1);
    expect(shell?.getAttribute("data-sidebar")).toBe("open");

    fireEvent.click(screen.getByTitle(en.hideSidebar));
    expect(shell?.getAttribute("data-sidebar")).toBe("closed");

    fireEvent.click(screen.getByTitle(en.showSidebar));
    expect(shell?.getAttribute("data-sidebar")).toBe("open");
  });

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
