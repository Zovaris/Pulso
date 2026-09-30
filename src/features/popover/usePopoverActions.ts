import { useCallback } from "react";
import { useStore } from "@/app/store";
import { useAddProject } from "@/features/projects/useAddProject";
import {
  closePopover,
  openMainWindow,
  quitPulso,
  showPopover,
} from "@/lib/tauri";

export type PopoverActions = {
  addProject: () => void;
  manageCommands: () => void;
  openApp: () => void;
  quit: () => void;
};

export function usePopoverActions(): PopoverActions {
  const pickAndAddProject = useAddProject();

  const addProject = useCallback(() => {
    void pickAndAddProject().then(() => showPopover());
  }, [pickAndAddProject]);

  const manageCommands = useCallback(() => {
    useStore.getState().setSection("commands");
    void openMainWindow();
    void closePopover();
  }, []);

  const openApp = useCallback(() => {
    void openMainWindow();
    void closePopover();
  }, []);

  const quit = useCallback(() => {
    void quitPulso();
  }, []);

  return { addProject, manageCommands, openApp, quit };
}
