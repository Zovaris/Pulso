import { useCallback } from "react";
import { useAddProject } from "@/features/projects/useAddProject";
import {
  closePopover,
  openMainWindow,
  quitPulso,
  showPopover,
} from "@/lib/tauri";

export type PopoverActions = {
  addProject: () => void;
  openApp: () => void;
  quit: () => void;
};

export function usePopoverActions(): PopoverActions {
  const pickAndAddProject = useAddProject();

  const addProject = useCallback(() => {
    void pickAndAddProject().then(() => showPopover());
  }, [pickAndAddProject]);

  const openApp = useCallback(() => {
    void openMainWindow();
    void closePopover();
  }, []);

  const quit = useCallback(() => {
    void quitPulso();
  }, []);

  return { addProject, openApp, quit };
}
