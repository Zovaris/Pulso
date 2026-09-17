import { describe, expect, it } from "vitest";
import { createCueTracker, cueForTransition } from "@/features/executions/cues";
import type { Execution, ExecutionState } from "@/lib/types";

function execution(
  id: number,
  state: ExecutionState,
  overrides: Partial<Execution> = {},
): Execution {
  return {
    id,
    projectId: 1,
    commandId: "package.json:dev",
    label: "dev",
    program: "bun",
    args: ["run", "dev"],
    cwd: "/tmp/project",
    state,
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

describe("cueForTransition", () => {
  it("starts a fresh execution with a pulse", () => {
    expect(cueForTransition(undefined, execution(1, "starting"))).toBe("pulse");
  });

  it("says nothing while a command is still working", () => {
    for (const state of ["running", "stopping"] as ExecutionState[]) {
      expect(cueForTransition("starting", execution(1, state))).toBeNull();
    }
  });

  it("calls a clean exit a success", () => {
    expect(
      cueForTransition("running", execution(1, "exited", { exitCode: 0 })),
    ).toBe("success");
  });

  it("stays quiet when the exit was asked for", () => {
    expect(cueForTransition("stopping", execution(1, "exited"))).toBeNull();
  });

  it("calls any other ending a failure", () => {
    expect(
      cueForTransition("running", execution(1, "failed", { exitCode: 1 })),
    ).toBe("error");
    expect(cueForTransition("running", execution(1, "failed"))).toBe("error");
  });
});

describe("createCueTracker", () => {
  it("greets an execution once and follows it to its end", () => {
    const tracker = createCueTracker();

    expect(tracker.observe(execution(1, "starting"))).toBe("pulse");
    expect(tracker.observe(execution(1, "running"))).toBeNull();
    expect(tracker.observe(execution(1, "exited", { exitCode: 0 }))).toBe(
      "success",
    );
  });

  it("ignores a state it has already seen", () => {
    const tracker = createCueTracker();

    expect(tracker.observe(execution(1, "starting"))).toBe("pulse");
    expect(tracker.observe(execution(1, "starting"))).toBeNull();
    expect(tracker.observe(execution(1, "failed"))).toBe("error");
    expect(tracker.observe(execution(1, "failed"))).toBeNull();
  });

  it("keeps two executions apart", () => {
    const tracker = createCueTracker();

    tracker.observe(execution(1, "starting"));
    expect(tracker.observe(execution(2, "starting"))).toBe("pulse");
    expect(tracker.observe(execution(2, "failed"))).toBe("error");
    expect(tracker.observe(execution(1, "running"))).toBeNull();
  });

  it("does not greet an execution it meets halfway", () => {
    const tracker = createCueTracker();

    expect(tracker.observe(execution(1, "running"))).toBeNull();
    expect(tracker.observe(execution(1, "exited"))).toBe("success");
  });
});
