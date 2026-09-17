import { act, renderHook } from "@testing-library/react";
import { play } from "cuelume";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { useExecutionCues } from "@/features/executions/useExecutionCues";
import type { Execution, ExecutionState } from "@/lib/types";

const listeners = vi.hoisted(() => ({
  emit: undefined as ((execution: Execution) => void) | undefined,
}));

vi.mock("cuelume", () => ({ play: vi.fn() }));
vi.mock("@/lib/events", () => ({
  onExecutionChanged: (handler: (execution: Execution) => void) => {
    listeners.emit = handler;
    return Promise.resolve(() => {
      if (listeners.emit === handler) listeners.emit = undefined;
    });
  },
}));

function execution(id: number, state: ExecutionState): Execution {
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
  };
}

async function mount() {
  renderHook(() => useExecutionCues());
  await act(async () => {});
}

async function emit(execution_: Execution) {
  await act(async () => {
    listeners.emit?.(execution_);
  });
}

beforeEach(() => {
  vi.mocked(play).mockClear();
  listeners.emit = undefined;
  useStore.setState({ sound: true });
});

describe("useExecutionCues", () => {
  it("plays the cue the transition deserves", async () => {
    await mount();

    await emit(execution(1, "starting"));
    await emit(execution(1, "running"));
    await emit(execution(1, "failed"));

    expect(vi.mocked(play).mock.calls).toEqual([
      ["pulse", { volume: 0.35 }],
      ["error", { volume: 0.55 }],
    ]);
  });

  it("stays silent when the preference is off", async () => {
    useStore.setState({ sound: false });
    await mount();

    await emit(execution(1, "starting"));
    await emit(execution(1, "failed"));

    expect(play).not.toHaveBeenCalled();
  });

  it("stops listening once the preference goes off", async () => {
    await mount();
    await emit(execution(1, "starting"));

    act(() => {
      useStore.setState({ sound: false });
    });
    await emit(execution(1, "failed"));

    expect(vi.mocked(play).mock.calls).toEqual([["pulse", { volume: 0.35 }]]);
  });
});
