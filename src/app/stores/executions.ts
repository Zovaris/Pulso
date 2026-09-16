import type { StateCreator } from "zustand";
import { commandKey } from "@/features/executions/execution";
import type { Execution, LogLine } from "@/lib/types";
import { toBackendError } from "@/services/api/errors";
import * as executionsApi from "@/services/api/executions";
import type { AppStore } from "./types";

export type ExecutionsSlice = Pick<
  AppStore,
  | "executions"
  | "pendingCommandId"
  | "logs"
  | "openLogKey"
  | "loadExecutions"
  | "applyExecution"
  | "startCommand"
  | "stopExecution"
  | "applyLogs"
  | "loadLogs"
  | "toggleLogs"
  | "closeLogs"
  | "openUrl"
>;

const KEPT_LINES = 400;

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
  logs: {},
  openLogKey: null,

  applyExecution: (execution) =>
    set((state) => ({ executions: upsert(state.executions, execution) })),

  loadExecutions: async () => {
    try {
      set({ executions: await executionsApi.listExecutions() });
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    }
  },

  startCommand: async (projectId, commandId) => {
    set({ pendingCommandId: commandId, projectError: null });
    try {
      const execution = await executionsApi.startCommand(projectId, commandId);
      set((state) => ({
        executions: upsert(state.executions, execution),
        openLogKey: commandKey(projectId, commandId),
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
