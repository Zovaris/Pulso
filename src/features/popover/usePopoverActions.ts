import { useCallback } from "react";
import { useAddProject } from "@/features/projects/useAddProject";
import {
  hidePopover,
  openMainWindow,
  quitSoffy,
  showPopover,
} from "@/lib/tauri";

export type PopoverActions = {
  addProject: () => void;
  openApp: () => void;
  quit: () => void;
};

/**
 * Rust keeps the popover open while the folder panel is up, and this restores
 * its focus once the panel closes, whether a folder was picked or not.
 */
export function usePopoverActions(): PopoverActions {
  const pickAndAddProject = useAddProject();

  const addProject = useCallback(() => {
    void pickAndAddProject().then(() => showPopover());
  }, [pickAndAddProject]);

  const openApp = useCallback(() => {
    void openMainWindow();
    void hidePopover();
  }, []);

  const quit = useCallback(() => {
    void quitSoffy();
  }, []);

  return { addProject, openApp, quit };
}
