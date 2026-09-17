import type { StateCreator } from "zustand";
import { pushSample } from "@/features/desktop/metrics";
import { commandKey, isActiveState } from "@/features/executions/execution";
import type { Execution, LogLine } from "@/lib/types";
import { toBackendError } from "@/services/api/errors";
import * as executionsApi from "@/services/api/executions";
import type { AppStore } from "./types";

export type ExecutionsSlice = Pick<
  AppStore,
  | "executions"
  | "pendingCommandId"
  | "metrics"
  | "histories"
  | "logs"
  | "openLogKey"
  | "loadExecutions"
  | "applyExecution"
  | "applyMetrics"
  | "startCommand"
  | "stopExecution"
  | "restartExecution"
  | "clearFinished"
  | "applyLogs"
  | "loadLogs"
  | "toggleLogs"
  | "closeLogs"
  | "openUrl"
>;

const KEPT_LINES = 4000;

function upsert(executions: Execution[], execution: Execution): Execution[] {
  const index = executions.findIndex(
    (existing) => existing.id === execution.id,
  );
  if (index === -1) return [...executions, execution];

  const next = [...executions];
  next[index] = execution;
  return next;
}

function lastSeq(lines: LogLine[] | undefined): number {
  if (!lines || lines.length === 0) return 0;
  return lines[lines.length - 1].seq;
}

function merge(
  existing: LogLine[] | undefined,
  incoming: LogLine[],
): LogLine[] {
  if (incoming.length === 0) return existing ?? [];

  const known = existing ?? [];
  const last = lastSeq(known);
  const fresh = incoming.filter((line) => line.seq > last);
  if (fresh.length === 0) return known;

  const merged = [...known, ...fresh];
  return merged.length > KEPT_LINES ? merged.slice(-KEPT_LINES) : merged;
}

export const createExecutionsSlice: StateCreator<
  AppStore,
  [],
  [],
  ExecutionsSlice
> = (set, get) => ({
  executions: [],
  pendingCommandId: null,
  metrics: {},
  histories: {},
  logs: {},
  openLogKey: null,

  applyExecution: (execution) => {
    const previous = get().executions.find(
      (entry) => entry.id === execution.id,
    );
    const ended =
      previous !== undefined &&
      isActiveState(previous.state) &&
      !isActiveState(execution.state);

    set((state) => ({
      executions: upsert(state.executions, execution),
      selectedExecutionId: state.selectedExecutionId ?? execution.id,
    }));

    // The run was just written down, so the stored timeline is one step behind
    // until it is read again.
    const projectId = get().historyProject;
    if (ended && projectId !== null) void get().loadHistory(projectId);
  },

  applyMetrics: (samples) =>
    set((state) => {
      const metrics = { ...state.metrics };
      const histories = { ...state.histories };

      for (const sample of samples) {
        metrics[sample.executionId] = sample;
        histories[sample.executionId] = pushSample(
          histories[sample.executionId] ?? [],
          sample.cpu,
        );
      }

      // A reading that stopped arriving means the process is gone, so the
      // numbers must go with it rather than freeze at the last value.
      const live = new Set(samples.map((sample) => sample.executionId));
      for (const id of Object.keys(metrics)) {
        if (live.has(Number(id))) continue;

        delete metrics[Number(id)];
        delete histories[Number(id)];
      }

      return { metrics, histories };
    }),

  loadExecutions: async () => {
    try {
      set({ executions: await executionsApi.listExecutions() });
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    }
  },

  startCommand: async (projectId, commandId, args = null) => {
    set({ pendingCommandId: commandId, projectError: null });
    try {
      const execution = await executionsApi.startCommand(
        projectId,
        commandId,
        args,
      );
      set((state) => ({
        executions: upsert(state.executions, execution),
        openLogKey: commandKey(projectId, commandId),
        selectedExecutionId: execution.id,
        argsFor: null,
      }));
      void get().loadLogs(execution.id);
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    } finally {
      set((state) => ({
        pendingCommandId:
          state.pendingCommandId === commandId ? null : state.pendingCommandId,
      }));
    }
  },

  stopExecution: async (executionId) => {
    try {
      get().applyExecution(await executionsApi.stopExecution(executionId));
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    }
  },

  /**
   * Stop, then start again from the declaration. The manifest is the source of
   * truth here: one-off arguments belong to the run that asked for them.
   */
  restartExecution: async (executionId) => {
    const execution = get().executions.find(
      (entry) => entry.id === executionId,
    );
    if (!execution) return;

    const { projectId, commandId } = execution;

    await get().stopExecution(executionId);
    await get().startCommand(projectId, commandId);
  },

  clearFinished: async () => {
    try {
      const executions = await executionsApi.clearFinished();
      set((state) => ({
        executions,
        selectedExecutionId: executions.some(
          (entry) => entry.id === state.selectedExecutionId,
        )
          ? state.selectedExecutionId
          : (executions[0]?.id ?? null),
      }));
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    }
  },

  applyLogs: (executionId, lines) =>
    set((state) => ({
      logs: {
        ...state.logs,
        [executionId]: merge(state.logs[executionId], lines),
      },
    })),

  loadLogs: async (executionId) => {
    const afterSeq = lastSeq(get().logs[executionId]) || null;

    try {
      const snapshot = await executionsApi.getLogSnapshot(
        executionId,
        afterSeq,
        KEPT_LINES,
      );
      get().applyLogs(executionId, snapshot.lines);
    } catch (cause) {
      const error = toBackendError(cause);
      if (error.kind !== "notFound") set({ projectError: error });
    }
  },

  toggleLogs: (key, executionId) => {
    const open = get().openLogKey === key;
    set({ openLogKey: open ? null : key });

    if (!open && executionId !== null) void get().loadLogs(executionId);
  },

  closeLogs: () => set({ openLogKey: null }),

  openUrl: async (executionId, portId) => {
    try {
      await executionsApi.openDetectedUrl(executionId, portId);
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    }
  },
});
