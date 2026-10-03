import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import type { AppStore } from "@/app/stores/types";
import { PopoverShell } from "@/features/popover/PopoverShell";
import { activity } from "@/features/popover/menubar/MenubarMenu";
import type {
  CommandScan,
  DetectedCommand,
  Execution,
  Project,
} from "@/lib/types";

vi.mock("@/lib/tauri", () => ({
  isTauri: () => false,
  closePopover: vi.fn(() => Promise.resolve()),
  fitPopover: vi.fn(() => Promise.resolve()),
  openMainWindow: vi.fn(() => Promise.resolve()),
  quitPulso: vi.fn(() => Promise.resolve()),
  showPopover: vi.fn(() => Promise.resolve()),
  pickProjectFolder: vi.fn(() => Promise.resolve(null)),
}));

const projects: Project[] = [
  { id: 1, name: "api", path: "/p/api", availability: "available" },
  { id: 2, name: "web", path: "/p/web", availability: "available" },
];

function command(label: string, project: Project): DetectedCommand {
  return {
    id: `package_json:${label}`,
    label,
    program: "bun",
    args: ["run", label],
    cwd: project.path,
    source: "package.json",
    detector: "package_json",
    category: "other",
    longRunning: false,
  };
}

function scan(
  project: Project,
  labels: string[],
  favorites: string[] = [],
): CommandScan {
  return {
    projectId: project.id,
    status: "detected",
    detail: null,
    commands: labels.map((label) => command(label, project)),
    flags: Object.fromEntries(
      favorites.map((label) => [
        `package_json:${label}`,
        { favorite: true, hidden: false },
      ]),
    ),
  };
}

let nextId = 1;
function execution(overrides: Partial<Execution>): Execution {
  return {
    id: nextId++,
    projectId: 1,
    commandId: "package_json:dev",
    label: "dev",
    program: "bun",
    args: ["run", "dev"],
    cwd: "/p/api",
    state: "running",
    pid: 10,
    startedAt: 1_000,
    endedAt: null,
    exitCode: null,
    detail: null,
    restartedFrom: null,
    ports: [],
    ...overrides,
  };
}

const startCommand = vi.fn(async () => {});
const stopExecution = vi.fn(async () => {});
const restartExecution = vi.fn(async () => {});

function setup(overrides: Partial<AppStore> = {}) {
  useStore.setState({
    locale: "en",
    projects,
    scans: {
      "1": scan(projects[0], ["dev", "test", "lint"], ["test", "lint"]),
      "2": scan(projects[1], ["dev", "build"]),
    },
    customCommands: [],
    executions: [],
    logs: {},
    seenFailuresAt: 0,
    confirmStop: false,
    pendingCommandId: null,
    projectError: null,
    rescanning: false,
    startCommand,
    stopExecution,
    restartExecution,
    loadLogs: vi.fn(async () => {}),
    rescanProjects: vi.fn(async () => {}),
    ...overrides,
  });
  return render(<PopoverShell />);
}

function item(name: RegExp | string) {
  return screen.getByRole("menuitem", { name });
}

function press(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    fireEvent.keyDown(document.activeElement ?? window, { key, ...init });
  });
}

beforeEach(() => {
  nextId = 1;
  startCommand.mockClear();
  stopExecution.mockClear();
  restartExecution.mockClear();
});

describe("activity", () => {
  it("lists what runs, oldest first, then failures not yet seen", () => {
    const late = execution({ projectId: 2, startedAt: 5_000 });
    const early = execution({ commandId: "package_json:a", startedAt: 2_000 });
    const failed = execution({
      commandId: "package_json:test",
      state: "failed",
      endedAt: 9_000,
      exitCode: 1,
    });
    const seen = execution({
      commandId: "package_json:old",
      state: "failed",
      endedAt: 3_000,
      exitCode: 1,
    });

    expect(
      activity([late, early, failed, seen], 4_000).map((entry) => entry.id),
    ).toEqual([early.id, late.id, failed.id]);
  });

  it("only counts the latest run of each command", () => {
    const first = execution({ state: "failed", endedAt: 9_000, exitCode: 1 });
    const rerun = execution({ state: "exited", endedAt: 9_500, exitCode: 0 });

    expect(activity([first, rerun], 0)).toEqual([]);
  });
});

describe("menubar menu", () => {
  it("says when nothing runs and keeps the menu to launchers and app items", () => {
    setup();

    expect(screen.getByText("Nothing running")).toBeTruthy();
    expect(item(/^test/)).toBeTruthy();
    expect(item(/^Projects/)).toBeTruthy();
    expect(item(/^Quit Pulso/)).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("puts a running command at the top and not again among favorites", () => {
    setup({
      executions: [
        execution({
          commandId: "package_json:test",
          label: "test",
          ports: [{ id: "p", port: 3000, url: "http://localhost:3000" }],
        }),
      ],
    });

    const rows = screen.getAllByRole("menuitem", { name: /^test/ });
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain(":3000");
    expect(screen.getByText("1 running")).toBeTruthy();
  });

  it("shows five favorites and moves the rest behind a submenu", () => {
    setup({
      scans: {
        "1": scan(
          projects[0],
          ["a", "b", "c", "d", "e", "f", "g"],
          ["a", "b", "c", "d", "e", "f", "g"],
        ),
      },
    });

    fireEvent.click(item(/^More favorites/));

    expect(
      screen.getAllByRole("menuitem", { name: /^[a-g]api$/ }),
    ).toHaveLength(7);
  });

  it("runs a stopped command when its row is chosen", () => {
    setup();

    fireEvent.click(item(/^lint/));

    expect(startCommand).toHaveBeenCalledWith(1, "package_json:lint");
  });

  it("stops from the row, or opens the detail first when stopping asks for confirmation", () => {
    const running = execution({});
    setup({ executions: [running] });
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(stopExecution).toHaveBeenCalledWith(running.id);

    stopExecution.mockClear();
    act(() => useStore.setState({ confirmStop: true }));
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(stopExecution).not.toHaveBeenCalled();
    expect(item(/^Stop/)).toBeTruthy();
  });

  it("offers a failed command again from its row", () => {
    const failed = execution({ state: "failed", endedAt: 2_000, exitCode: 1 });
    setup({ executions: [failed] });

    expect(item(/^dev/).textContent).toContain("exited 1");
    fireEvent.click(screen.getByRole("button", { name: "Run again" }));

    expect(restartExecution).toHaveBeenCalledWith(failed.id);
  });

  it("shows the latest output and the explicit actions of a run", () => {
    const running = execution({
      ports: [{ id: "p", port: 5173, url: "http://localhost:5173" }],
    });
    setup({
      executions: [running],
      logs: {
        [running.id]: [
          { seq: 1, at: 0, stream: "stdout", text: "ready on 5173" },
        ],
      },
    });

    fireEvent.click(item(/^dev/));

    expect(screen.getByText("ready on 5173")).toBeTruthy();
    expect(item(/^Restart/)).toBeTruthy();
    expect(item(/^Open localhost:5173/)).toBeTruthy();
    fireEvent.click(item(/^Stop/));
    expect(stopExecution).toHaveBeenCalledWith(running.id);
  });

  it("drills into a project and back", () => {
    setup();

    fireEvent.click(item(/^Projects/));
    fireEvent.click(item(/^web/));
    expect(item(/^build/)).toBeTruthy();

    fireEvent.click(item(/^web$/));
    expect(item(/^api/)).toBeTruthy();
  });

  it("offers to add a folder when there are no projects", () => {
    setup({ projects: [], scans: {} });

    expect(screen.getByText("No projects yet")).toBeTruthy();
    expect(item(/^Add project/)).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /^Projects/ })).toBeNull();
  });
});

describe("menubar keyboard", () => {
  it("moves one highlight with the arrows and wraps around", () => {
    setup();
    const all = screen.getAllByRole("menuitem");

    press("ArrowDown");
    expect(document.activeElement).toBe(all[0]);
    press("ArrowUp");
    expect(document.activeElement).toBe(all[all.length - 1]);
  });

  it("opens a submenu with Right and returns to the same item with Left", () => {
    setup();
    act(() => item(/^Projects/).focus());

    press("ArrowRight");
    expect(item(/^web/)).toBeTruthy();
    expect((document.activeElement as HTMLElement).textContent).toContain(
      "api",
    );

    press("ArrowLeft");
    expect((document.activeElement as HTMLElement).textContent).toContain(
      "Projects",
    );
  });

  it("starts a search from typing and clears it with Escape", () => {
    setup();
    act(() => item(/^Projects/).focus());

    press("b");
    const field = screen.getByRole("searchbox");
    expect((field as HTMLInputElement).value).toBe("b");
    fireEvent.change(field, { target: { value: "build" } });
    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", {
        name: /^buildweb/,
      }),
    ).toBeTruthy();

    press("Escape");
    expect((field as HTMLInputElement).value).toBe("");
    press("Escape");
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("stops the highlighted run with ⌘⌫ but never restarts with it", () => {
    const running = execution({});
    const failed = execution({
      projectId: 2,
      state: "failed",
      endedAt: 2_000,
      exitCode: 1,
    });
    setup({ executions: [running, failed] });

    act(() => screen.getAllByRole("menuitem", { name: /^dev/ })[1].focus());
    press("Backspace", { metaKey: true });
    expect(restartExecution).not.toHaveBeenCalled();

    act(() => screen.getAllByRole("menuitem", { name: /^dev/ })[0].focus());
    press("Backspace", { metaKey: true });
    expect(stopExecution).toHaveBeenCalledWith(running.id);
  });

  it("runs the item whose shortcut is pressed", () => {
    const rescanProjects = vi.fn(async () => {});
    setup({ rescanProjects });

    fireEvent.click(item(/^Projects/));
    press("r", { metaKey: true });

    expect(rescanProjects).toHaveBeenCalled();
  });
});
