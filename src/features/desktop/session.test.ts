import { describe, expect, it } from "vitest";
import {
  byUptime,
  exitBadge,
  failures,
  finishedExecutions,
  lastRun,
  liveExecutions,
  openPorts,
  recentRuns,
} from "@/features/desktop/session";
import type { Execution, ExecutionState } from "@/lib/types";

function execution(
  id: number,
  state: ExecutionState,
  extra: Partial<Execution> = {},
): Execution {
  return {
    id,
    projectId: extra.projectId ?? 1,
    commandId: extra.commandId ?? "pkg:dev",
    label: extra.label ?? "dev",
    program: "bun",
    args: ["run", "dev"],
    cwd: "/tmp",
    state,
    pid: 4_800 + id,
    startedAt: extra.startedAt ?? id * 1000,
    endedAt: extra.endedAt ?? null,
    exitCode: extra.exitCode ?? null,
    detail: null,
    restartedFrom: null,
    ports: extra.ports ?? [],
  };
}

const all: Execution[] = [
  execution(1, "exited", { exitCode: 0, endedAt: 5000 }),
  execution(2, "running", {
    startedAt: 2000,
    ports: [{ id: "p", port: 4321, url: null }],
  }),
  execution(3, "failed", { exitCode: 1, endedAt: 9000 }),
  execution(4, "stopping", { startedAt: 1000 }),
];

describe("liveExecutions", () => {
  it("counts everything still holding a process", () => {
    expect(liveExecutions(all).map((entry) => entry.id)).toEqual([2, 4]);
  });
});

describe("finishedExecutions", () => {
  it("puts the most recent run first", () => {
    expect(finishedExecutions(all).map((entry) => entry.id)).toEqual([3, 1]);
  });
});

describe("failures", () => {
  it("finds only what failed", () => {
    expect(failures(all).map((entry) => entry.id)).toEqual([3]);
  });
});

describe("openPorts", () => {
  it("lists the ports only live processes are holding", () => {
    const withDead = [
      ...all,
      execution(5, "exited", { ports: [{ id: "q", port: 9999, url: null }] }),
    ];

    expect(openPorts(withDead)).toEqual([4321]);
  });

  it("says nothing when nothing is listening", () => {
    expect(openPorts([execution(1, "exited")])).toEqual([]);
  });
});

describe("exitBadge", () => {
  it("shows the code that came out", () => {
    expect(exitBadge(execution(1, "exited", { exitCode: 0 }))).toEqual({
      text: "0",
      tone: "ok",
    });
    expect(exitBadge(execution(2, "failed", { exitCode: 1 }))).toEqual({
      text: "1",
      tone: "bad",
    });
  });

  it("says nothing while it is still running", () => {
    expect(exitBadge(execution(3, "running")).tone).toBe("none");
  });

  it("marks a process that died without a code", () => {
    expect(exitBadge(execution(4, "failed"))).toEqual({
      text: "·",
      tone: "bad",
    });
  });
});

describe("byUptime", () => {
  it("puts the longest running first", () => {
    expect(byUptime(all).map((entry) => entry.id)).toEqual([4, 2]);
  });
});

describe("lastRun", () => {
  it("finds the most recent run of one command", () => {
    const runs = [
      execution(1, "exited", { commandId: "pkg:dev", startedAt: 100 }),
      execution(2, "running", { commandId: "pkg:dev", startedAt: 900 }),
      execution(3, "exited", { commandId: "pkg:test", startedAt: 500 }),
    ];

    expect(lastRun(runs, 1, "pkg:dev")?.id).toBe(2);
  });

  it("says nothing about a command that never ran", () => {
    expect(lastRun(all, 1, "pkg:nope")).toBeUndefined();
  });
});

describe("recentRuns", () => {
  it("keeps the newest runs of one project only", () => {
    const runs = [
      execution(1, "exited", { projectId: 1, startedAt: 100 }),
      execution(2, "exited", { projectId: 2, startedAt: 900 }),
      execution(3, "exited", { projectId: 1, startedAt: 800 }),
    ];

    expect(recentRuns(runs, 1).map((entry) => entry.id)).toEqual([3, 1]);
  });

  it("respects the limit it was given", () => {
    const runs = Array.from({ length: 9 }, (_, index) =>
      execution(index, "exited", { startedAt: index }),
    );

    expect(recentRuns(runs, 1, 3)).toHaveLength(3);
  });
});
