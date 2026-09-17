import { describe, expect, it } from "vitest";
import {
  runBadge,
  runDuration,
  runStamp,
  type TimelineRun,
  timeline,
} from "@/features/desktop/history";
import type { Execution, ExecutionState, HistoryEntry } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

function execution(
  id: number,
  state: ExecutionState,
  extra: Partial<Execution> = {},
): Execution {
  return {
    id,
    projectId: extra.projectId ?? 1,
    commandId: extra.commandId ?? "package_json:dev",
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
    ports: [],
  };
}

function entry(id: number, extra: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id,
    projectId: extra.projectId ?? 1,
    commandId: extra.commandId ?? "package_json:dev",
    label: extra.label ?? "dev",
    program: "bun",
    args: ["run", "dev"],
    cwd: "/tmp",
    state: extra.state ?? "exited",
    startedAt: extra.startedAt ?? id * 1000,
    endedAt: extra.endedAt ?? id * 1000 + 500,
    exitCode: extra.exitCode ?? 0,
    detail: null,
    lines: extra.lines ?? 12,
  };
}

function run(extra: Partial<TimelineRun> = {}): TimelineRun {
  return {
    key: "h:1",
    source: "history",
    id: 1,
    label: "dev",
    commandId: "package_json:dev",
    state: "exited",
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_002_500,
    exitCode: 0,
    detail: null,
    lines: 12,
    ...extra,
  };
}

describe("timeline", () => {
  it("puts this session and the file in one order, newest first", () => {
    const runs = timeline(
      [execution(1, "running", { startedAt: 500 })],
      [entry(9, { startedAt: 3_000 }), entry(8, { startedAt: 1_000 })],
      1,
    );

    expect(runs.map((entry) => entry.key)).toEqual(["h:9", "h:8", "s:1"]);
    expect(runs.map((entry) => entry.source)).toEqual([
      "history",
      "history",
      "session",
    ]);
  });

  it("keeps the run the session still holds once the file has it too", () => {
    const runs = timeline(
      [
        execution(1, "failed", {
          startedAt: 4_000,
          endedAt: 5_000,
          exitCode: 2,
        }),
      ],
      [entry(9, { startedAt: 4_000, state: "exited", exitCode: 0 })],
      1,
    );

    expect(runs).toHaveLength(1);
    expect(runs[0].source).toBe("session");
    expect(runs[0].exitCode).toBe(2);
  });

  it("answers for one project and respects the limit", () => {
    const runs = timeline(
      [execution(1, "exited", { projectId: 2, startedAt: 9_000 })],
      [
        entry(7, { startedAt: 900 }),
        entry(6, { startedAt: 800 }),
        entry(5, { startedAt: 700 }),
      ],
      1,
      2,
    );

    expect(runs.map((entry) => entry.key)).toEqual(["h:7", "h:6"]);
  });

  it("says nothing about a project that never ran", () => {
    expect(timeline([], [], 4)).toEqual([]);
  });
});

describe("runBadge", () => {
  it("shows the code that came out", () => {
    expect(runBadge(run({ exitCode: 0 }))).toEqual({ text: "0", tone: "ok" });
    expect(runBadge(run({ exitCode: 1, state: "failed" }))).toEqual({
      text: "1",
      tone: "bad",
    });
  });

  it("holds the exit code back while the run is still going", () => {
    expect(runBadge(run({ state: "running", exitCode: null }))).toEqual({
      text: "·",
      tone: "none",
    });
  });

  it("marks a run the app was closed on without calling it a failure", () => {
    expect(runBadge(run({ state: "interrupted", exitCode: null }))).toEqual({
      text: "—",
      tone: "none",
    });
  });
});

describe("runDuration", () => {
  it("measures a run that ended", () => {
    expect(runDuration(run())).toBe("0:02");
  });

  it("counts up while it is still going", () => {
    const running = run({
      state: "running",
      endedAt: null,
      startedAt: 1_700_000_000_000,
    });

    expect(runDuration(running, 1_700_000_065_000)).toBe("1:05");
  });
});

describe("runStamp", () => {
  const now = new Date(2026, 8, 16, 18, 30, 0).getTime();

  it("shows the clock for today", () => {
    expect(runStamp(new Date(2026, 8, 16, 14, 5, 0).getTime(), now, "es")).toBe(
      "14:05",
    );
  });

  it("shows the day for anything older", () => {
    expect(runStamp(now - DAY, now, "es").endsWith(":30")).toBe(true);
    expect(runStamp(now - DAY, now, "es")).not.toBe("18:30");
  });
});
