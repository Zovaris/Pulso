import type { StateCreator } from "zustand";
import * as api from "@/services/api/customCommands";
import { toBackendError } from "@/services/api/errors";
import type { AppStore } from "./types";

export const createCustomCommandsSlice: StateCreator<
  AppStore,
  [],
  [],
  Pick<
    AppStore,
    | "customCommands"
    | "loadCustomCommands"
    | "applyCustomCommands"
    | "saveCustomCommand"
    | "deleteCustomCommand"
  >
> = (set, get) => ({
  customCommands: [],
  applyCustomCommands: (customCommands) => set({ customCommands }),
  loadCustomCommands: async () => {
    try {
      const before = get().customCommands;
      const commands = await api.listCustomCommands();
      if (get().customCommands === before) get().applyCustomCommands(commands);
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    }
  },
  saveCustomCommand: async (command) => {
    try {
      get().applyCustomCommands(await api.saveCustomCommand(command));
      set({ projectError: null });
      return true;
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
      return false;
    }
  },
  deleteCustomCommand: async (id) => {
    try {
      get().applyCustomCommands(await api.deleteCustomCommand(id));
      set({ projectError: null });
      return true;
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
      return false;
    }
  },
});
