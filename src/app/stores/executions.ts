import type { StateCreator } from "zustand";
import type { Execution } from "@/lib/types";
import { toBackendError } from "@/services/api/errors";
import * as executionsApi from "@/services/api/executions";
import type { AppStore } from "./types";

export type ExecutionsSlice = Pick<
  AppStore,
  | "executions"
  | "pendingCommandId"
  | "loadExecutions"
  | "applyExecution"
  | "startCommand"
  | "stopExecution"
>;

function upsert(executions: Execution[], execution: Execution): Execution[] {
  const index = executions.findIndex(
    (existing) => existing.id === execution.id,
  );
  if (index === -1) return [...executions, execution];

  const next = [...executions];
  next[index] = execution;
  return next;
}

export const createExecutionsSlice: StateCreator<
  AppStore,
  [],
  [],
  ExecutionsSlice
> = (set, get) => ({
  executions: [],
  pendingCommandId: null,

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
      get().applyExecution(
        await executionsApi.startCommand(projectId, commandId),
      );
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
});
