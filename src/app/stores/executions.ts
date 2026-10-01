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
  | "removeExecutions"
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

const KEPT_FINISHED = 50;

function newer(
  previous: Execution | undefined,
  incoming: Execution,
): Execution {
  if (!previous) return incoming;
  if ((previous.revision ?? 0) > (incoming.revision ?? 0)) return previous;
  if (!isActiveState(previous.state) && isActiveState(incoming.state))
    return previous;
  if (previous.state === "stopping" && incoming.state === "running")
    return previous;
  return incoming;
}

function upsert(executions: Execution[], execution: Execution): Execution[] {
  const index = executions.findIndex(
    (existing) => existing.id === execution.id,
  );
  if (index === -1)
    return [...executions, execution].sort((a, b) => a.id - b.id);

  const next = [...executions];
  next[index] = newer(executions[index], execution);
  return next;
}

function lastSeq(lines: LogLine[] | undefined): number {
  if (!lines || lines.length === 0) return 0;
  return lines[lines.length - 1].seq;
}

function merge(
  existing: LogLine[] | undefined,
  incoming: LogLine[],
  limit: number,
): LogLine[] {
  if (incoming.length === 0) return existing ?? [];

  const known = existing ?? [];
  const last = lastSeq(known);
  let merged: LogLine[];
  if (incoming[0].seq > last) {
    merged = [...known, ...incoming];
  } else {
    const bySeq = new Map(known.map((line) => [line.seq, line]));
    for (const line of incoming) bySeq.set(line.seq, line);
    merged = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  }
  let start = Math.max(0, merged.length - limit);
  let bytes = 0;
  for (let index = merged.length - 1; index >= start; index -= 1) {
    bytes += merged[index].text.length * 2;
    if (bytes > limit * 128 && index < merged.length - 1) {
      start = index + 1;
      break;
    }
  }
  return merged.slice(start);
}

export const createExecutionsSlice: StateCreator<
  AppStore,
  [],
  [],
  ExecutionsSlice
> = (set, get) => {
  const removed: [number, number][] = [];
  const wasRemoved = (id: number) =>
    removed.some(([start, end]) => id >= start && id <= end);
  let loading = 0;
  return {
    executions: [],
    pendingCommandId: null,
    metrics: {},
    histories: {},
    logs: {},
    openLogKey: null,

    removeExecutions: (ids) => {
      for (const id of ids) removed.push([id, id]);
      removed.sort(([a], [b]) => a - b);
      for (let index = 1; index < removed.length;) {
        if (removed[index][0] <= removed[index - 1][1] + 1) {
          removed[index - 1][1] = Math.max(
            removed[index - 1][1],
            removed[index][1],
          );
          removed.splice(index, 1);
        } else index += 1;
      }
      set((state) => {
        const executions = state.executions.filter(
          (entry) => !wasRemoved(entry.id),
        );
        const retain = <T>(values: Record<number, T>) =>
          Object.fromEntries(
            Object.entries(values).filter(([id]) => !wasRemoved(Number(id))),
          );
        return {
          executions,
          logs: retain(state.logs),
          metrics: retain(state.metrics),
          histories: retain(state.histories),
          selectedExecutionId: executions.some(
            (entry) => entry.id === state.selectedExecutionId,
          )
            ? state.selectedExecutionId
            : (executions[0]?.id ?? null),
        };
      });
    },

    applyExecution: (execution) => {
      if (wasRemoved(execution.id)) return;
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

      const finished = get()
        .executions.filter((entry) => !isActiveState(entry.state))
        .sort((a, b) => b.id - a.id);
      if (finished.length > KEPT_FINISHED)
        get().removeExecutions(
          finished.slice(KEPT_FINISHED).map((entry) => entry.id),
        );
      const projectId = get().historyProject;
      if (ended && projectId !== null) void get().loadHistory(projectId);
    },

    applyMetrics: (samples) =>
      set((state) => {
        const metrics = { ...state.metrics };
        const histories = { ...state.histories };

        for (const sample of samples) {
          if (wasRemoved(sample.executionId)) continue;
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
      const request = ++loading;
      const before = new Map(
        get().executions.map((entry) => [entry.id, entry]),
      );
      try {
        const snapshot = await executionsApi.listExecutions();
        if (request !== loading) return;
        const merged = snapshot
          .filter((entry) => !wasRemoved(entry.id))
          .map((entry) =>
            newer(
              get().executions.find((known) => known.id === entry.id),
              entry,
            ),
          );
        for (const entry of get().executions) {
          if (
            entry !== before.get(entry.id) &&
            !merged.some((known) => known.id === entry.id)
          )
            merged.push(entry);
        }
        const kept = new Set(merged.map((entry) => entry.id));
        get().removeExecutions(
          get()
            .executions.filter((entry) => !kept.has(entry.id))
            .map((entry) => entry.id),
        );
        set({ executions: merged.sort((a, b) => a.id - b.id) });
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
        get().applyExecution(execution);
        set({
          openLogKey: commandKey(projectId, commandId),
          selectedExecutionId: execution.id,
          argsFor: null,
        });
        void get().loadLogs(execution.id);
      } catch (cause) {
        set({ projectError: toBackendError(cause) });
      } finally {
        set((state) => ({
          pendingCommandId:
            state.pendingCommandId === commandId
              ? null
              : state.pendingCommandId,
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

      try {
        const stopped = await executionsApi.stopExecution(executionId);
        get().applyExecution(stopped);
        if (isActiveState(stopped.state)) return;
        await get().startCommand(projectId, commandId);
      } catch (cause) {
        set({ projectError: toBackendError(cause) });
      }
    },

    clearFinished: async () => {
      try {
        const before = get().executions;
        const executions = await executionsApi.clearFinished();
        const kept = new Set(executions.map((entry) => entry.id));
        get().removeExecutions(
          before
            .filter(
              (entry) => !isActiveState(entry.state) && !kept.has(entry.id),
            )
            .map((entry) => entry.id),
        );
        for (const execution of executions) get().applyExecution(execution);
      } catch (cause) {
        set({ projectError: toBackendError(cause) });
      }
    },

    applyLogs: (executionId, lines) => {
      if (wasRemoved(executionId) || lines.length === 0) return;
      set((state) => ({
        logs: {
          ...state.logs,
          [executionId]: merge(state.logs[executionId], lines, state.logLines),
        },
      }));
    },

    loadLogs: async (executionId) => {
      try {
        const snapshot = await executionsApi.getLogSnapshot(
          executionId,
          null,
          get().logLines,
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
  };
};
