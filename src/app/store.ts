import { create } from "zustand";
import { createProjectsSlice } from "@/app/stores/projects";
import { createSessionSlice } from "@/app/stores/session";
import type { AppStore } from "@/app/stores/types";

export type { AppStore, StoreActions, StoreState } from "@/app/stores/types";

export const useStore = create<AppStore>()((...args) => ({
  ...createSessionSlice(...args),
  ...createProjectsSlice(...args),
}));
