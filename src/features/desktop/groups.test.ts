import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { catalogRows } from "@/features/desktop/catalog";
import { groupRuns, groupStatus } from "@/features/desktop/groups";
import type {
  CommandGroup,
  CommandScan,
  Execution,
  Project,
} from "@/lib/types";

const api: Project = {
  id: 1,
  name: "api",
  path: "/p/api",
  availability: "available",
};
const web: Project = {
  id: 2,
  name: "web",
  path: "/p/web",
  availability: "available",
};
const scan = (project: Project): CommandScan => ({
  projectId: project.id,
  status: "detected",
  detail: null,
  commands: [
    {
      id: "package_json:dev",
      label: "dev",
      program: "bun",
      args: ["run", "dev"],
      cwd: project.path,
      source: "package.json",
      detector: "package_json",
      category: "dev",
      longRunning: true,
    },
  ],
  flags: {},
});
const stack: CommandGroup = {
  id: 1,
  label: "Stack",
  members: [
    { projectId: 2, commandId: "package_json:dev" },
    { projectId: 1, commandId: "package_json:dev" },
    { projectId: 1, commandId: "package_json:gone" },
  ],
};
const run = (
  id: number,
  projectId: number,
  state: Execution["state"] = "running",
): Execution => ({
  id,
  projectId,
  commandId: "package_json:dev",
  label: "dev",
  program: "bun",
  args: [],
  cwd: "/p",
  state,
  pid: 1,
  startedAt: id,
  endedAt: null,
  exitCode: null,
  detail: null,
  restartedFrom: null,
  ports: [],
});
const rows = () =>
  catalogRows([api, web], { "1": scan(api), "2": scan(web) }, [], "Personal");

describe("groupStatus", () => {
  it("keeps the members that still exist, in the group's order, and counts what runs", () => {
    const status = groupStatus(stack, rows(), [run(1, 1)]);

    expect(status.rows.map((row) => row.projectName)).toEqual(["web", "api"]);
    expect(status).toMatchObject({ running: 1, total: 2 });
  });

  it("only counts the latest run of each member", () => {
    expect(
      groupStatus(stack, rows(), [run(1, 1), run(2, 1, "exited")]).running,
    ).toBe(0);
  });
});

describe("starting and stopping a group", () => {
  const startCommand = vi.fn(async () => {});
  const stopExecution = vi.fn(async () => {});

  beforeEach(() => {
    startCommand.mockClear();
    stopExecution.mockClear();
    useStore.setState({ executions: [], startCommand, stopExecution });
  });

  it("starts every member that is not running, in order", async () => {
    useStore.setState({ executions: [run(1, 2)] });

    await useStore.getState().startGroup(stack);

    expect(startCommand.mock.calls).toEqual([
      [1, "package_json:dev"],
      [1, "package_json:gone"],
    ]);
  });

  it("stops only what runs and leaves a stopping run alone", async () => {
    useStore.setState({ executions: [run(1, 1), run(2, 2, "stopping")] });

    expect(
      groupRuns(stack, useStore.getState().executions).map(
        (execution) => execution.id,
      ),
    ).toEqual([2, 1]);
    await useStore.getState().stopGroup(stack);

    expect(stopExecution.mock.calls).toEqual([[1]]);
  });
});
