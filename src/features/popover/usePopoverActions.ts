import { useCallback } from "react";
import { hidePopover, openMainWindow, quitSoffy } from "@/lib/tauri";

export type PopoverActions = {
  addProject: () => void;
  openApp: () => void;
  openSettings: () => void;
  quit: () => void;
};

/**
 * Acciones del pie del popover. `openApp` y `openSettings` son hoy la misma
 * acción porque todavía no existe una ruta de settings; ambas mostrarán la
 * ventana principal hasta que exista `app/router.ts`.
 */
export function usePopoverActions(): PopoverActions {
  const openApp = useCallback(() => {
    void openMainWindow();
    void hidePopover();
  }, []);

  const addProject = useCallback(() => {
    // TODO: abrir el selector nativo de carpetas (plugin dialog) antes de
    // mostrar la ventana principal.
    void openMainWindow();
  }, []);

  const quit = useCallback(() => {
    void quitSoffy();
  }, []);

  return { addProject, openApp, openSettings: openApp, quit };
}
