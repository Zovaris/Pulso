import type { StateCreator } from "zustand";
import {
  commandKey,
  isActiveState,
  latestExecution,
} from "@/features/executions/execution";
import {
  moveCursor as advance,
  cursorRows,
  projectRowKey,
  rowAt,
} from "@/features/popover/cursor";
import { toggleSection } from "@/features/popover/sections";
import type { AppStore } from "./types";

export type CursorSlice = Pick<
  AppStore,
  | "cursor"
  | "setCursor"
  | "moveCursor"
  | "stepCursor"
  | "activateCursor"
  | "collapsedSections"
  | "toggleSection"
>;

const rowsFor = (state: AppStore) =>
  cursorRows(
    state.projects,
    state.scans,
    state.expandedProjectId,
    state.customCommands,
    state.executions,
    state.collapsedSections,
  );

export const createCursorSlice: StateCreator<AppStore, [], [], CursorSlice> = (
  set,
  get,
) => ({
  cursor: null,
  collapsedSections: [],

  setCursor: (key) => set({ cursor: key }),

  toggleSection: (section) =>
    set((state) => ({
      collapsedSections: toggleSection(state.collapsedSections, section),
    })),

  moveCursor: (delta) =>
    set((state) => ({
      cursor: advance(rowsFor(state), state.cursor, delta),
    })),

  stepCursor: (direction) => {
    const state = get();
    const row = rowAt(rowsFor(state), state.cursor);
    if (!row) return;

    if (row.kind === "project") {
      const open = state.expandedProjectId === row.projectId;

      if (direction === "in" ? !open : open) {
        state.toggleProject(row.projectId);
      }
      return;
    }

    const key = commandKey(row.projectId, row.commandId);

    if (direction === "in") {
      const execution = latestExecution(
        state.executions,
        row.projectId,
        row.commandId,
      );

      if (execution && state.openLogKey !== key) {
        state.toggleLogs(key, execution.id);
      }
      return;
    }

    if (state.openLogKey === key) {
      state.closeLogs();
      return;
    }

    set({ cursor: projectRowKey(row.projectId) });
  },

  activateCursor: () => {
    const state = get();
    const row = rowAt(rowsFor(state), state.cursor);
    if (!row) return;

    if (row.kind === "project") {
      state.toggleProject(row.projectId);
      return;
    }

    const execution = latestExecution(
      state.executions,
      row.projectId,
      row.commandId,
    );

    if (execution && isActiveState(execution.state)) {
      if (execution.state !== "stopping")
        void state.stopExecution(execution.id);
      return;
    }

    if (state.pendingCommandId === row.commandId) return;

    void state.startCommand(row.projectId, row.commandId);
  },
});
