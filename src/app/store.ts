import { create } from "zustand";
import { createSessionSlice } from "@/app/stores/session";
import type { AppStore } from "@/app/stores/types";

export type { AppStore, StoreActions, StoreState } from "@/app/stores/types";

export const useStore = create<AppStore>()((...args) => ({
  ...createSessionSlice(...args),
}));
