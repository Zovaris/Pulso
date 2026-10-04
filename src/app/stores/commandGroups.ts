import type { StateCreator } from "zustand";
import { groupRuns } from "@/features/desktop/groups";
import {
  isActiveState,
  latestExecution,
} from "@/features/executions/execution";
import * as api from "@/services/api/commandGroups";
import { toBackendError } from "@/services/api/errors";
import type { AppStore } from "./types";

export const createCommandGroupsSlice: StateCreator<
  AppStore,
  [],
  [],
  Pick<
    AppStore,
    | "commandGroups"
    | "loadCommandGroups"
    | "applyCommandGroups"
    | "saveCommandGroup"
    | "deleteCommandGroup"
    | "startGroup"
    | "stopGroup"
  >
> = (set, get) => ({
  commandGroups: [],
  applyCommandGroups: (commandGroups) => set({ commandGroups }),
  loadCommandGroups: async () => {
    try {
      const before = get().commandGroups;
      const groups = await api.listCommandGroups();
      if (get().commandGroups === before) get().applyCommandGroups(groups);
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    }
  },
  saveCommandGroup: async (group) => {
    try {
      get().applyCommandGroups(await api.saveCommandGroup(group));
      set({ projectError: null });
      return true;
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
      return false;
    }
  },
  deleteCommandGroup: async (id) => {
    try {
      get().applyCommandGroups(await api.deleteCommandGroup(id));
      set({ projectError: null });
      return true;
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
      return false;
    }
  },
  startGroup: async (group) => {
    for (const member of group.members) {
      const last = latestExecution(
        get().executions,
        member.projectId,
        member.commandId,
      );
      if (last && isActiveState(last.state)) continue;
      await get().startCommand(member.projectId, member.commandId);
    }
  },
  stopGroup: async (group) => {
    await Promise.all(
      groupRuns(group, get().executions)
        .filter((execution) => execution.state !== "stopping")
        .map((execution) => get().stopExecution(execution.id)),
    );
  },
});
