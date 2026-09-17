import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { commandRowKey, projectRowKey } from "@/features/popover/cursor";
import type {
  CommandScan,
  DetectedCommand,
  Execution,
  Project,
} from "@/lib/types";
import * as executionsApi from "@/services/api/executions";
import * as projectsApi from "@/services/api/projects";

vi.mock("@/services/api/projects", () => ({
  listProjects: vi.fn(),
  addProject: vi.fn(),
  removeProject: vi.fn(),
  listCommands: vi.fn(),
  rescanProjects: vi.fn(),
}));

vi.mock("@/services/api/executions", () => ({
  listExecutions: vi.fn(),
  startCommand: vi.fn(),
  stopExecution: vi.fn(),
  getLogSnapshot: vi.fn(),
  openDetectedUrl: vi.fn(),
}));

const api = vi.mocked(executionsApi);
const projects = vi.mocked(projectsApi);

const project: Project = {
  id: 1,
  name: "project",
  path: "/tmp/project",
  availability: "available",
};

const dev: DetectedCommand = {
  id: "dev",
  label: "dev",
  program: "bun",
  args: ["run", "dev"],
  cwd: "/tmp/project",
  source: "/tmp/package.json",
  detector: "package_json",
  category: "build",
  longRunning: true,
};

const scan: CommandScan = {
  projectId: 1,
  commands: [dev],
  status: "detected",
  detail: null,
};

const running: Execution = {
  id: 7,
  projectId: 1,
  commandId: "dev",
  label: dev.label,
  program: dev.program,
  args: dev.args,
  cwd: dev.cwd,
  state: "running",
  pid: 42,
  startedAt: 0,
  endedAt: null,
  exitCode: null,
  detail: null,
  restartedFrom: null,
  ports: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    projects: [project],
    scans: { "1": scan },
    expandedProjectId: null,
    executions: [],
    logs: {},
    openLogKey: null,
    pendingCommandId: null,
    cursor: null,
    projectError: null,
  });
});

describe("moveCursor", () => {
  it("self-selects with the first press", () => {
    useStore.getState().moveCursor(1);

    expect(useStore.getState().cursor).toBe(projectRowKey(1));
  });

  it("keeps walking down the group the list is showing", () => {
    useStore.getState().moveCursor(1);
    useStore.getState().setCursor(projectRowKey(1));
    useStore.setState({ expandedProjectId: 1 });

    useStore.getState().moveCursor(1);

    expect(useStore.getState().cursor).toBe(commandRowKey(1, "dev"));
  });
});

describe("stepCursor", () => {
  it("opens a project to the right and closes it to the left", () => {
    useStore.getState().setCursor(projectRowKey(1));

    useStore.getState().stepCursor("in");
    expect(useStore.getState().expandedProjectId).toBe(1);
    expect(projects.listCommands).toHaveBeenCalledWith(1);

    useStore.getState().stepCursor("out");
    expect(useStore.getState().expandedProjectId).toBeNull();
  });

  it("does nothing to a project already in that state", () => {
    useStore.getState().setCursor(projectRowKey(1));

    useStore.getState().stepCursor("out");

    expect(useStore.getState().expandedProjectId).toBeNull();
    expect(projects.listCommands).not.toHaveBeenCalled();
  });

  it("opens the logs of a command that has run", () => {
    useStore.setState({
      expandedProjectId: 1,
      executions: [running],
      cursor: commandRowKey(1, "dev"),
    });

    useStore.getState().stepCursor("in");

    expect(useStore.getState().openLogKey).toBe("1:dev");
  });

  it("closes the logs before it leaves a command", () => {
    useStore.setState({
      expandedProjectId: 1,
      executions: [running],
      openLogKey: "1:dev",
      cursor: commandRowKey(1, "dev"),
    });

    useStore.getState().stepCursor("out");

    expect(useStore.getState().openLogKey).toBeNull();
    expect(useStore.getState().cursor).toBe(commandRowKey(1, "dev"));
  });

  it("goes back to the project from a command", () => {
    useStore.setState({
      expandedProjectId: 1,
      executions: [running],
      cursor: commandRowKey(1, "dev"),
    });

    useStore.getState().stepCursor("out");

    expect(useStore.getState().cursor).toBe(projectRowKey(1));
  });
});

describe("activateCursor", () => {
  it("opens the project it is standing on", () => {
    useStore.getState().setCursor(projectRowKey(1));

    useStore.getState().activateCursor();

    expect(useStore.getState().expandedProjectId).toBe(1);
  });

  it("runs the command it is standing on", () => {
    api.startCommand.mockResolvedValue(running);
    useStore.setState({
      expandedProjectId: 1,
      cursor: commandRowKey(1, "dev"),
    });

    useStore.getState().activateCursor();

    expect(api.startCommand).toHaveBeenCalledWith(1, "dev");
  });

  it("stops it again once it is running", () => {
    api.stopExecution.mockResolvedValue({ ...running, state: "exited" });
    useStore.setState({
      expandedProjectId: 1,
      executions: [running],
      cursor: commandRowKey(1, "dev"),
    });

    useStore.getState().activateCursor();

    expect(api.stopExecution).toHaveBeenCalledWith(7);
  });

  it("keeps quiet without a row", () => {
    useStore.getState().activateCursor();

    expect(useStore.getState().expandedProjectId).toBeNull();
    expect(api.startCommand).not.toHaveBeenCalled();
  });
});
