import { describe, expect, it } from "vitest";
import {
  byUptime,
  exitBadge,
  failures,
  finishedExecutions,
  liveExecutions,
  openPorts,
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
