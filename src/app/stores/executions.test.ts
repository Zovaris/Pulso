import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import type { Execution, LogLine } from "@/lib/types";
import * as executionsApi from "@/services/api/executions";

vi.mock("@/services/api/executions", () => ({
  listExecutions: vi.fn(),
  startCommand: vi.fn(),
  stopExecution: vi.fn(),
  getLogSnapshot: vi.fn(),
  clearFinished: vi.fn(),
  openDetectedUrl: vi.fn(),
}));

const api = vi.mocked(executionsApi);

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
    pid: 900 + id,
    startedAt: 1_000,
    endedAt: null,
    exitCode: null,
    detail: null,
    restartedFrom: null,
    ports: [],
    ...overrides,
  };
}

function line(seq: number): LogLine {
  return { seq, at: 1_000 + seq, stream: "stdout", text: `line ${seq}` };
}

beforeEach(() => {
  useStore.setState({
    executions: [],
    logs: {},
    pendingCommandId: null,
    projectError: null,
    logLines: 4000,
    historyProject: null,
    metrics: {},
    histories: {},
  });
});

describe("applyExecution", () => {
  it("adds one it has not seen", () => {
    useStore.getState().applyExecution(execution(1));

    expect(useStore.getState().executions.map((item) => item.id)).toEqual([1]);
  });

  it("replaces the one it already has instead of duplicating it", () => {
    useStore.getState().applyExecution(execution(1));
    useStore.getState().applyExecution(execution(1, { state: "exited" }));

    const executions = useStore.getState().executions;
    expect(executions).toHaveLength(1);
    expect(executions[0].state).toBe("exited");
  });
});

describe("applyLogs", () => {
  it("keeps only what it has not seen", () => {
    useStore.getState().applyLogs(7, [line(1), line(2)]);
    useStore.getState().applyLogs(7, [line(2), line(3)]);

    expect(useStore.getState().logs[7].map((item) => item.seq)).toEqual([
      1, 2, 3,
    ]);
  });

  it("accepts an empty payload without losing what it had", () => {
    useStore.getState().applyLogs(7, [line(1)]);
    useStore.getState().applyLogs(7, []);

    expect(useStore.getState().logs[7]).toHaveLength(1);
  });

  it("keeps the buffer bounded and drops the oldest lines", () => {
    const flood = Array.from({ length: 4200 }, (_, index) => line(index + 1));

    useStore.getState().applyLogs(7, flood);

    const kept = useStore.getState().logs[7];
    expect(kept).toHaveLength(4000);
    expect(kept[0].seq).toBe(201);
    expect(kept[kept.length - 1].seq).toBe(4200);
  });
});

describe("loadLogs", () => {
  it("refreshes the retained tail to recover output missed while hidden", async () => {
    useStore.getState().applyLogs(7, [line(1), line(5)]);
    api.getLogSnapshot.mockResolvedValue({ executionId: 7, lines: [line(6)] });

    await useStore.getState().loadLogs(7);

    expect(api.getLogSnapshot).toHaveBeenCalledWith(7, null, 4000);
    expect(useStore.getState().logs[7].map((item) => item.seq)).toEqual([
      1, 5, 6,
    ]);
  });

  it("stays quiet when the execution is simply gone", async () => {
    api.getLogSnapshot.mockRejectedValue({
      kind: "notFound",
      message: "gone",
      path: null,
    });

    await useStore.getState().loadLogs(7);

    expect(useStore.getState().projectError).toBeNull();
  });

  it("reports anything else", async () => {
    api.getLogSnapshot.mockRejectedValue({
      kind: "storage",
      message: "disk",
      path: null,
    });

    await useStore.getState().loadLogs(7);

    expect(useStore.getState().projectError?.kind).toBe("storage");
  });
});

describe("startCommand", () => {
  it("registers the execution and opens its output", async () => {
    api.startCommand.mockResolvedValue(execution(4));
    api.getLogSnapshot.mockResolvedValue({ executionId: 4, lines: [] });

    await useStore.getState().startCommand(1, "package.json:dev");

    const state = useStore.getState();
    expect(state.executions.map((item) => item.id)).toEqual([4]);
    expect(state.selectedExecutionId).toBe(4);
    expect(state.pendingCommandId).toBeNull();
    expect(api.getLogSnapshot).toHaveBeenCalledWith(4, null, 4000);
  });

  it("clears the pending mark and reports the failure", async () => {
    api.startCommand.mockRejectedValue({
      kind: "notFound",
      message: "no such command",
      path: null,
    });

    await useStore.getState().startCommand(1, "package.json:dev");

    const state = useStore.getState();
    expect(state.pendingCommandId).toBeNull();
    expect(state.executions).toHaveLength(0);
    expect(state.projectError?.kind).toBe("notFound");
  });
});

describe("stopExecution", () => {
  it("takes the updated execution", async () => {
    useStore.getState().applyExecution(execution(4));
    api.stopExecution.mockResolvedValue(execution(4, { state: "stopping" }));

    await useStore.getState().stopExecution(4);

    expect(useStore.getState().executions[0].state).toBe("stopping");
  });

  it("reports a stop that failed", async () => {
    api.stopExecution.mockRejectedValue(new Error("boom"));

    await useStore.getState().stopExecution(4);

    expect(useStore.getState().projectError).toEqual({
      kind: "internal",
      message: "boom",
      path: null,
    });
  });
});

describe("reconciliation", () => {
  it("does not regress a terminal state with a late start response", async () => {
    useStore
      .getState()
      .applyExecution(execution(101, { state: "exited", revision: 4 }));
    api.startCommand.mockResolvedValue(execution(101, { revision: 2 }));
    api.getLogSnapshot.mockResolvedValue({ executionId: 101, lines: [] });
    await useStore.getState().startCommand(1, "package.json:dev");
    expect(useStore.getState().executions[0].state).toBe("exited");
  });

  it("preserves events arriving while a snapshot is in flight", async () => {
    let resolve!: (runs: Execution[]) => void;
    api.listExecutions.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const loading = useStore.getState().loadExecutions();
    useStore
      .getState()
      .applyExecution(execution(102, { state: "exited", revision: 4 }));
    useStore.getState().applyExecution(execution(103));
    resolve([execution(102, { revision: 2 })]);
    await loading;
    expect(useStore.getState().executions.map((entry) => entry.id)).toEqual([
      102, 103,
    ]);
    expect(useStore.getState().executions[0].state).toBe("exited");
  });

  it("cleans associated data and ignores late events after removal", () => {
    useStore.getState().applyExecution(execution(104));
    useStore.getState().applyLogs(104, [line(1)]);
    useStore.getState().removeExecutions([104]);
    useStore.getState().applyExecution(execution(104));
    useStore.getState().applyLogs(104, [line(2)]);
    expect(useStore.getState().executions).toEqual([]);
    expect(useStore.getState().logs[104]).toBeUndefined();
  });

  it("merges an earlier snapshot even if live output arrived first", () => {
    useStore.getState().applyLogs(105, [line(4)]);
    useStore.getState().applyLogs(105, [line(1), line(2), line(3)]);
    expect(useStore.getState().logs[105].map((entry) => entry.seq)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("honors the chosen retention instead of a hardcoded cap", () => {
    useStore.setState({ logLines: 500 });
    useStore.getState().applyLogs(
      106,
      Array.from({ length: 800 }, (_, index) => line(index + 1)),
    );
    expect(useStore.getState().logs[106]).toHaveLength(500);
  });

  it("does not restart when stopping failed", async () => {
    useStore.getState().applyExecution(execution(107));
    api.stopExecution.mockRejectedValue(new Error("stop failed"));
    await useStore.getState().restartExecution(107);
    expect(api.startCommand).not.toHaveBeenCalled();
    expect(useStore.getState().projectError?.message).toBe("stop failed");
  });

  it("keeps old live executions while compacting many removed IDs", () => {
    useStore.getState().applyExecution(execution(1000));
    useStore
      .getState()
      .removeExecutions(
        Array.from({ length: 300 }, (_, index) => 1001 + index),
      );
    useStore.getState().applyExecution(execution(1001));
    expect(useStore.getState().executions.map((entry) => entry.id)).toEqual([
      1000,
    ]);
  });

  it("drops logs when finished runs are cleared", async () => {
    useStore.getState().applyExecution(execution(108, { state: "exited" }));
    useStore.getState().applyLogs(108, [line(1)]);
    api.clearFinished.mockResolvedValue([]);
    await useStore.getState().clearFinished();
    expect(useStore.getState().logs[108]).toBeUndefined();
  });
});

describe("openUrl", () => {
  it("reports a port that could not be opened", async () => {
    api.openDetectedUrl.mockRejectedValue({
      kind: "internal",
      message: "no browser",
      path: null,
    });

    await useStore.getState().openUrl(4, "log:4321");

    expect(api.openDetectedUrl).toHaveBeenCalledWith(4, "log:4321");
    expect(useStore.getState().projectError?.message).toBe("no browser");
  });
});
