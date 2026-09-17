import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { HISTORY } from "@/features/desktop/metrics";
import type { CommandScan, LogLine, MetricsSample } from "@/lib/types";
import * as dataApi from "@/services/api/data";
import * as editorsApi from "@/services/api/editors";
import * as executionsApi from "@/services/api/executions";

vi.mock("@/services/api/data", () => ({
  dataStatus: vi.fn(),
  revealDataFolder: vi.fn(),
  exportProjects: vi.fn(),
  importProjects: vi.fn(),
  diagnosticBundle: vi.fn(),
}));

vi.mock("@/services/api/editors", () => ({
  listEditors: vi.fn(),
  appIcon: vi.fn(),
  openProject: vi.fn(),
}));

vi.mock("@/services/api/executions", () => ({
  listExecutions: vi.fn(),
  startCommand: vi.fn(),
  stopExecution: vi.fn(),
  clearFinished: vi.fn(),
  getLogSnapshot: vi.fn(),
  openDetectedUrl: vi.fn(),
  saveLogText: vi.fn(),
}));

const data = vi.mocked(dataApi);
const editors = vi.mocked(editorsApi);
const executions = vi.mocked(executionsApi);

function line(seq: number, text: string): LogLine {
  return { seq, at: 1_000 + seq, stream: "stdout", text };
}

function sample(
  executionId: number,
  cpu: number,
  memory = 1024,
): MetricsSample {
  return { executionId, cpu, memory, processes: 2 };
}

function scan(flags: CommandScan["flags"]): CommandScan {
  return {
    projectId: 1,
    commands: [],
    status: "detected",
    detail: null,
    flags,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    editors: [],
    icons: {},
    metrics: {},
    histories: {},
    logs: {},
    executions: [],
    scans: {},
    projects: [],
    selectedExecutionId: null,
    selectedProjectId: null,
    commandFilter: "all",
    logFilter: { query: "", stream: "all" },
    paletteOpen: false,
    confirmingStop: null,
    argsFor: null,
    data: null,
    environment: null,
    environmentFor: null,
    working: null,
    notice: null,
    editor: null,
  });
});

describe("applyMetrics", () => {
  it("keeps the newest reading per execution", () => {
    useStore.getState().applyMetrics([sample(1, 4), sample(2, 9)]);

    expect(useStore.getState().metrics[1].cpu).toBe(4);
    expect(useStore.getState().metrics[2].cpu).toBe(9);
  });

  it("builds a sparkline history as readings arrive", () => {
    useStore.getState().applyMetrics([sample(1, 1)]);
    useStore.getState().applyMetrics([sample(1, 2)]);

    expect(useStore.getState().histories[1]).toEqual([1, 2]);
  });

  it("caps the history so it cannot grow forever", () => {
    for (let index = 0; index < HISTORY + 5; index += 1) {
      useStore.getState().applyMetrics([sample(1, index)]);
    }

    expect(useStore.getState().histories[1]).toHaveLength(HISTORY);
    expect(useStore.getState().histories[1][0]).toBe(5);
  });

  it("forgets an execution whose readings stopped arriving", () => {
    useStore.getState().applyMetrics([sample(1, 4), sample(2, 9)]);
    useStore.getState().applyMetrics([sample(2, 3)]);

    expect(useStore.getState().metrics[1]).toBeUndefined();
    expect(useStore.getState().histories[1]).toBeUndefined();
    expect(useStore.getState().metrics[2].cpu).toBe(3);
  });

  it("clears everything when the last process leaves", () => {
    useStore.getState().applyMetrics([sample(1, 4)]);
    useStore.getState().applyMetrics([]);

    expect(useStore.getState().metrics).toEqual({});
  });
});

describe("applyFlags", () => {
  it("writes the flags onto the scan that already exists", () => {
    useStore.setState({ scans: { "1": scan({}) } });

    useStore
      .getState()
      .applyFlags(1, { "pkg:dev": { favorite: true, hidden: false } });

    expect(useStore.getState().scans["1"].flags["pkg:dev"].favorite).toBe(true);
  });

  it("stays quiet about a project that has not been read", () => {
    useStore
      .getState()
      .applyFlags(9, { "pkg:dev": { favorite: true, hidden: false } });

    expect(useStore.getState().scans).toEqual({});
  });
});

describe("setSection", () => {
  it("clears the failure marker when the processes are opened", () => {
    useStore.setState({ seenFailuresAt: 1 });

    useStore.getState().setSection("processes");

    expect(useStore.getState().seenFailuresAt).toBeGreaterThan(1);
  });

  it("leaves the marker alone for any other section", () => {
    useStore.setState({ seenFailuresAt: 1, section: "overview" });

    useStore.getState().setSection("logs");

    expect(useStore.getState().seenFailuresAt).toBe(1);
  });
});

describe("selectProject", () => {
  it("throws away an environment report that belonged to the other project", () => {
    useStore.setState({
      environment: {
        shell: "/bin/zsh",
        path: "/bin",
        entries: [],
        programs: [],
      },
      environmentFor: 1,
    });

    useStore.getState().selectProject(2);

    expect(useStore.getState().environment).toBeNull();
    expect(useStore.getState().environmentFor).toBeNull();
    expect(useStore.getState().selectedProjectId).toBe(2);
  });
});

describe("loadEditors", () => {
  it("fetches an icon for each editor, once", async () => {
    editors.listEditors.mockResolvedValue([
      { id: "cursor", name: "Cursor", bundleId: "a", path: "/a" },
      { id: "zed", name: "Zed", bundleId: "b", path: "/b" },
    ]);
    editors.appIcon.mockResolvedValue("data:image/png;base64,AA");

    await useStore.getState().loadEditors();
    await useStore.getState().loadEditors();

    expect(useStore.getState().editors).toHaveLength(2);
    expect(useStore.getState().icons.cursor).toBe("data:image/png;base64,AA");
    expect(editors.appIcon).toHaveBeenCalledTimes(2);
  });

  it("keeps the list even when an icon cannot be drawn", async () => {
    editors.listEditors.mockResolvedValue([
      { id: "cursor", name: "Cursor", bundleId: "a", path: "/a" },
    ]);
    editors.appIcon.mockResolvedValue(null);

    await useStore.getState().loadEditors();

    expect(useStore.getState().editors).toHaveLength(1);
    expect(useStore.getState().icons.cursor).toBeUndefined();
  });
});

describe("openProjectIn", () => {
  it("remembers the editor the backend says it used", async () => {
    editors.openProject.mockResolvedValue("zed");

    await useStore.getState().openProjectIn(1, "zed");

    expect(useStore.getState().editor).toBe("zed");
  });

  it("does not touch the default when the folder was only revealed", async () => {
    editors.openProject.mockResolvedValue(null);
    useStore.setState({ editor: "cursor" });

    await useStore.getState().openProjectIn(1, "finder");

    expect(useStore.getState().editor).toBe("cursor");
  });
});

describe("saveLog", () => {
  it("writes what is on screen, not what is in the buffer", async () => {
    executions.saveLogText.mockResolvedValue("/tmp/dev.log");
    useStore.setState({
      logs: {
        4: [line(1, "building client"), line(2, "error: missing module")],
      },
      logFilter: { query: "error", stream: "all" },
      executions: [
        {
          id: 4,
          projectId: 1,
          commandId: "pkg:dev",
          label: "dev",
          program: "bun",
          args: ["run", "dev"],
          cwd: "/tmp",
          state: "exited",
          pid: 12,
          startedAt: 1_700_000_000_000,
          endedAt: 1_700_000_001_000,
          exitCode: 0,
          detail: null,
          restartedFrom: null,
          ports: [],
        },
      ],
    });

    await useStore.getState().saveLog(4, "dev");

    const [text, name] = executions.saveLogText.mock.calls[0];
    expect(text).toContain("error: missing module");
    expect(text).not.toContain("building client");
    expect(name).toMatch(/^dev-\d{8}-\d{4}\.log$/);
    expect(useStore.getState().notice).toBe("/tmp/dev.log");
  });

  it("says nothing when the user cancels the dialog", async () => {
    executions.saveLogText.mockResolvedValue(null);

    await useStore.getState().saveLog(4, "dev");

    expect(useStore.getState().notice).toBeNull();
  });
});

describe("data actions", () => {
  it("keeps the folder the export was written to", async () => {
    data.exportProjects.mockResolvedValue("/tmp/pulso-projects.json");

    await useStore.getState().exportProjects();

    expect(useStore.getState().notice).toBe("/tmp/pulso-projects.json");
  });

  it("reloads the projects after importing, so the window catches up", async () => {
    data.importProjects.mockResolvedValue(3);
    const loadProjects = vi.fn().mockResolvedValue(undefined);
    useStore.setState({ loadProjects });

    await useStore.getState().importProjects();

    expect(loadProjects).toHaveBeenCalled();
    expect(useStore.getState().notice).toBe("3");
  });

  it("tells the truth when the user backs out of the import", async () => {
    data.importProjects.mockResolvedValue(null);

    await useStore.getState().importProjects();

    expect(useStore.getState().notice).toBeNull();
  });

  it("surfaces a failure instead of quietly doing nothing", async () => {
    data.dataStatus.mockRejectedValue({
      kind: "internal",
      message: "boom",
      path: null,
    });

    await useStore.getState().loadDataStatus();

    expect(useStore.getState().projectError?.message).toBe("boom");
    expect(useStore.getState().working).toBeNull();
  });
});
