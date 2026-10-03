import { useCallback } from "react";
import { emitTo } from "@tauri-apps/api/event";
import { useStore } from "@/app/store";
import type { SectionId } from "@/app/stores/types";
import { useAddProject } from "@/features/projects/useAddProject";
import {
  closePopover,
  isTauri,
  openMainWindow,
  quitPulso,
  showPopover,
} from "@/lib/tauri";

export type PopoverActions = {
  addProject: () => void;
  openApp: () => void;
  openSettings: () => void;
  openSection: (section: SectionId) => void;
  quit: () => void;
};

export function usePopoverActions(): PopoverActions {
  const pickAndAddProject = useAddProject();
  const addProject = useCallback(() => {
    void pickAndAddProject().then(() => showPopover());
  }, [pickAndAddProject]);
  const open = useCallback((section?: SectionId) => {
    if (!isTauri()) {
      useStore.setState({ surface: "app", ...(section ? { section } : {}) });
      document.documentElement.dataset.surface = "app";
      return;
    }
    void openMainWindow()
      .then(async () => {
        if (section) await emitTo("main", "navigation://section", section);
        await closePopover();
      })
      .catch(() =>
        useStore.getState().note(useStore.getState().t("desktopRequired")),
      );
  }, []);
  const openApp = useCallback(() => open(), [open]);
  const openSettings = useCallback(() => open("settings"), [open]);
  const quit = useCallback(() => {
    if (isTauri()) void quitPulso();
    else useStore.getState().note(useStore.getState().t("desktopRequired"));
  }, []);
  return { addProject, openApp, openSettings, openSection: open, quit };
}
