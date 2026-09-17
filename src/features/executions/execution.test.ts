import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  commandKey,
  formatDuration,
  formatLogTime,
  isActiveState,
  latestExecution,
  useElapsed,
} from "@/features/executions/execution";
import type { Execution, ExecutionState } from "@/lib/types";

function execution(id: number, overrides: Partial<Execution> = {}): Execution {
  return {
    id,
    projectId: 1,
    commandId: "package.json:dev",
    label: "dev",
    program: "bun",
    args: ["run", "dev"],
    cwd: "/tmp/project",
    state: "running",
    pid: 100 + id,
    startedAt: 1_000,
    endedAt: null,
    exitCode: null,
    detail: null,
    restartedFrom: null,
    ports: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("isActiveState", () => {
  it("counts the three states that are still alive", () => {
    const active: ExecutionState[] = ["starting", "running", "stopping"];
    const done: ExecutionState[] = ["exited", "failed"];

    expect(active.filter(isActiveState)).toEqual(active);
    expect(done.some(isActiveState)).toBe(false);
  });
});

describe("commandKey", () => {
  it("separates the project from the command", () => {
    expect(commandKey(3, "package.json:dev")).toBe("3:package.json:dev");
  });
});

describe("latestExecution", () => {
  it("takes the newest one for that command", () => {
    const executions = [execution(1), execution(2), execution(3)];

    expect(latestExecution(executions, 1, "package.json:dev")?.id).toBe(3);
  });

  it("ignores the same command in another project", () => {
    const executions = [
      execution(1),
      execution(2, { projectId: 9 }),
      execution(3, { commandId: "package.json:lint" }),
    ];

    expect(latestExecution(executions, 1, "package.json:dev")?.id).toBe(1);
    expect(latestExecution(executions, 4, "package.json:dev")).toBeUndefined();
  });
});

describe("formatDuration", () => {
  it("reads as minutes and seconds under an hour", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(1_000)).toBe("0:01");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_599_000)).toBe("59:59");
  });

  it("grows an hours field when it needs one", () => {
    expect(formatDuration(3_600_000)).toBe("1:00:00");
    expect(formatDuration(7_322_000)).toBe("2:02:02");
  });

  it("never shows a negative clock", () => {
    expect(formatDuration(-5_000)).toBe("0:00");
  });
});

describe("formatLogTime", () => {
  it("pads to a fixed width", () => {
    const at = new Date(2026, 0, 2, 3, 4, 5).getTime();

    expect(formatLogTime(at)).toBe("03:04:05");
  });
});

describe("useElapsed", () => {
  it("ticks once a second while the command runs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 10, 0, 0));
    const startedAt = Date.now();

    const { result } = renderHook(() => useElapsed(startedAt, true));
    expect(result.current).toBe("0:00");

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current).toBe("0:03");
  });

  it("shows nothing once it is over", () => {
    const { result } = renderHook(() => useElapsed(1_000, false));

    expect(result.current).toBe("");
  });

  it("shows nothing without a start time", () => {
    const { result } = renderHook(() => useElapsed(undefined, true));

    expect(result.current).toBe("");
  });
});
