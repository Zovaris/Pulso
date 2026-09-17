import type { StateCreator } from "zustand";
import type { CommandFilter } from "@/features/desktop/commands";
import {
  filterLines,
  type LogFilter,
  logName,
  logText,
  NO_FILTER,
} from "@/features/desktop/logs";
import * as dataApi from "@/services/api/data";
import * as editorsApi from "@/services/api/editors";
import * as environmentApi from "@/services/api/environment";
import { toBackendError } from "@/services/api/errors";
import * as executionsApi from "@/services/api/executions";
import type { AppStore } from "./types";

export type DesktopSlice = Pick<
  AppStore,
  | "editors"
  | "icons"
  | "selectedExecutionId"
  | "selectedProjectId"
  | "commandFilter"
  | "logFilter"
  | "logAutoscroll"
  | "paletteOpen"
  | "confirmingStop"
  | "argsFor"
  | "data"
  | "environment"
  | "environmentFor"
  | "working"
  | "notice"
  | "seenFailuresAt"
  | "loadEditors"
  | "openProjectIn"
  | "loadDataStatus"
  | "exportProjects"
  | "importProjects"
  | "revealDataFolder"
  | "makeDiagnosticBundle"
  | "loadEnvironment"
  | "saveLog"
  | "select"
  | "selectProject"
  | "setCommandFilter"
  | "setLogFilter"
  | "setLogAutoscroll"
  | "openPalette"
  | "closePalette"
  | "askStop"
  | "setArgsFor"
  | "note"
  | "dismissNotice"
  | "markFailuresSeen"
>;

const NOTICE_MS = 3200;

export const createDesktopSlice: StateCreator<
  AppStore,
  [],
  [],
  DesktopSlice
> = (set, get) => {
  const run = async (label: string, work: () => Promise<void>) => {
    set({ working: label, projectError: null });

    try {
      await work();
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    } finally {
      set((state) => ({
        working: state.working === label ? null : state.working,
      }));
    }
  };

  const note = (text: string) => {
    set({ notice: text });
    window.setTimeout(() => {
      if (get().notice === text) set({ notice: null });
    }, NOTICE_MS);
  };

  return {
    editors: [],
    icons: {},
    selectedExecutionId: null,
    selectedProjectId: null,
    commandFilter: "all",
    logFilter: NO_FILTER,
    logAutoscroll: true,
    paletteOpen: false,
    confirmingStop: null,
    argsFor: null,
    data: null,
    environment: null,
    environmentFor: null,
    working: null,
    notice: null,
    seenFailuresAt: Date.now(),

    loadEditors: async () => {
      await run("editors", async () => {
        const editors = await editorsApi.listEditors();
        set({ editors });

        for (const editor of editors) {
          if (get().icons[editor.id]) continue;

          const icon = await editorsApi.appIcon(editor.id).catch(() => null);
          if (icon)
            set((state) => ({ icons: { ...state.icons, [editor.id]: icon } }));
        }
      });
    },

    openProjectIn: async (projectId, editorId) => {
      await run("open", async () => {
        const used = await editorsApi.openProject(projectId, editorId);

        // The backend remembers the choice, so the Ajustes row and the header
        // chip have to agree with what just happened.
        if (used) set({ editor: used });
      });
    },

    loadDataStatus: async () => {
      await run("data", async () => set({ data: await dataApi.dataStatus() }));
    },

    exportProjects: async () => {
      await run("export", async () => {
        const path = await dataApi.exportProjects();
        if (path) note(path);
      });
    },

    importProjects: async () => {
      await run("import", async () => {
        const added = await dataApi.importProjects();
        if (added === null) return;

        await get().loadProjects();
        note(String(added));
      });
    },

    revealDataFolder: async () => {
      await run("reveal", async () => {
        await dataApi.revealDataFolder();
      });
    },

    makeDiagnosticBundle: async () => {
      await run("bundle", async () => {
        const path = await dataApi.diagnosticBundle();
        if (path) note(path);
      });
    },

    loadEnvironment: async (projectId) => {
      await run("environment", async () => {
        set({
          environment: await environmentApi.environmentReport(projectId),
          environmentFor: projectId,
        });
      });
    },

    saveLog: async (executionId, label) => {
      await run("save", async () => {
        const visible = filterLines(
          get().logs[executionId] ?? [],
          get().logFilter,
        );
        const execution = get().executions.find(
          (entry) => entry.id === executionId,
        );
        const path = await executionsApi.saveLogText(
          logText(visible),
          logName(label, execution?.startedAt ?? Date.now()),
        );

        if (path) note(path);
      });
    },

    select: (executionId) => set({ selectedExecutionId: executionId }),

    selectProject: (projectId) =>
      set({
        selectedProjectId: projectId,
        environment: null,
        environmentFor: null,
      }),

    setCommandFilter: (filter: CommandFilter) => set({ commandFilter: filter }),

    setLogFilter: (filter: LogFilter) => set({ logFilter: filter }),

    setLogAutoscroll: (value) => set({ logAutoscroll: value }),

    openPalette: () => set({ paletteOpen: true }),

    closePalette: () => set({ paletteOpen: false }),

    askStop: (executionId) => set({ confirmingStop: executionId }),

    setArgsFor: (key) => set({ argsFor: key }),

    note,

    dismissNotice: () => set({ notice: null }),

    markFailuresSeen: () => set({ seenFailuresAt: Date.now() }),
  };
};
