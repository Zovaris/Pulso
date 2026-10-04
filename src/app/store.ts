import { create } from "zustand";
import { createCommandGroupsSlice } from "@/app/stores/commandGroups";
import { createCustomCommandsSlice } from "@/app/stores/customCommands";
import { createDesktopSlice } from "@/app/stores/desktop";
import { createExecutionsSlice } from "@/app/stores/executions";
import { createProjectsSlice } from "@/app/stores/projects";
import { createSessionSlice } from "@/app/stores/session";
import type { AppStore } from "@/app/stores/types";

export type { AppStore, StoreActions, StoreState } from "@/app/stores/types";

export const useStore = create<AppStore>()((...args) => ({
  ...createSessionSlice(...args),
  ...createProjectsSlice(...args),
  ...createExecutionsSlice(...args),
  ...createDesktopSlice(...args),
  ...createCustomCommandsSlice(...args),
  ...createCommandGroupsSlice(...args),
}));
