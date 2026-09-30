import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { useProjectSync } from "@/features/projects/useProjectSync";
import * as events from "@/lib/events";
import type { Execution } from "@/lib/types";

vi.mock("@/lib/events", () => ({
  onProjectsChanged: vi.fn(),
  onCustomCommandsChanged: vi.fn(),
  onCommandsChanged: vi.fn(),
  onCommandFlagsChanged: vi.fn(),
  onExecutionChanged: vi.fn(),
  onExecutionsRemoved: vi.fn(),
  onLogAppended: vi.fn(),
  onPopoverPrepare: vi.fn(),
}));

const eventMocks = vi.mocked(events);
const loadProjects = vi.fn().mockResolvedValue(undefined);
const loadExecutions = vi.fn().mockResolvedValue(undefined);
const loadLogs = vi.fn().mockResolvedValue(undefined);
const unlisten = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  for (const subscribe of Object.values(eventMocks)) {
    vi.mocked(subscribe).mockResolvedValue(unlisten);
  }
  useStore.setState({
    loadProjects,
    loadExecutions,
    loadLogs,
    executions: [],
    selectedExecutionId: null,
    openLogKey: null,
  });
});

describe("useProjectSync", () => {
  it("waits for all listeners before requesting snapshots", async () => {
    let resolve!: (stop: () => void) => void;
    eventMocks.onExecutionChanged.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    renderHook(() => useProjectSync());
    expect(loadExecutions).not.toHaveBeenCalled();
    expect(loadProjects).not.toHaveBeenCalled();
    await act(async () => resolve(unlisten));
    await waitFor(() => expect(loadExecutions).toHaveBeenCalledTimes(1));
    expect(loadProjects).toHaveBeenCalledTimes(1);
  });

  it("cleans up a listener that registers after unmount", async () => {
    let resolve!: (stop: () => void) => void;
    eventMocks.onExecutionChanged.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { unmount } = renderHook(() => useProjectSync());
    unmount();
    await act(async () => resolve(unlisten));
    expect(unlisten).toHaveBeenCalledTimes(8);
    expect(loadExecutions).not.toHaveBeenCalled();
  });

  it("recovers logs for the latest run on focus", async () => {
    const run = (id: number): Execution => ({
      id,
      projectId: 1,
      commandId: "test:dev",
      label: "dev",
      program: "bun",
      args: [],
      cwd: "/tmp",
      state: "exited",
      pid: null,
      startedAt: id,
      endedAt: id + 1,
      exitCode: 0,
      detail: null,
      restartedFrom: null,
      ports: [],
    });
    useStore.setState({
      executions: [run(1), run(2)],
      openLogKey: "1:test:dev",
    });
    renderHook(() => useProjectSync());
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(loadLogs).toHaveBeenCalledWith(2);
    expect(loadLogs).not.toHaveBeenCalledWith(1);
  });
});
