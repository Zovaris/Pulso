import { useEffect } from "react";
import { useStore } from "@/app/store";
import { filterLines, logText } from "@/features/desktop/logs";
import { liveExecutions } from "@/features/desktop/session";
import { sectionAt } from "@/features/shell/sections";

const DIGIT = /^[1-9]$/;

function inField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

/**
 * The window's own keys. Modified keys are read even from a field, because ⌘R
 * and ⌘K mean the same thing wherever the caret is; plain keys are not, so a
 * search box keeps everything the user types.
 */
export function useShellKeyboard() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey && !event.ctrlKey && !event.altKey;

      if (command && event.key === "k") {
        event.preventDefault();
        const { paletteOpen, openPalette, closePalette } = useStore.getState();
        if (paletteOpen) closePalette();
        else openPalette();
        return;
      }

      if (command && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        const state = useStore.getState();
        const execution = state.executions.find(
          (entry) => entry.id === state.selectedExecutionId,
        );
        const lines = execution ? (state.logs[execution.id] ?? []) : [];
        void navigator.clipboard
          .writeText(logText(filterLines(lines, state.logFilter)))
          .then(() => state.note(state.t("copied")))
          .catch(() => undefined);
        return;
      }

      if (command && event.shiftKey) return;

      if (command && event.key === "r") {
        event.preventDefault();
        void useStore.getState().rescanProjects();
        return;
      }

      if (command && event.key === "o") {
        event.preventDefault();
        const state = useStore.getState();
        const project =
          state.projects.find(
            (entry) => entry.id === state.selectedProjectId,
          ) ?? state.projects[0];
        if (project) void state.openProjectIn(project.id, state.editor);
        return;
      }

      if (command && event.key === ".") {
        event.preventDefault();
        const state = useStore.getState();
        const selected = state.executions.find(
          (entry) => entry.id === state.selectedExecutionId,
        );
        const target =
          selected && liveExecutions([selected]).length > 0
            ? selected
            : liveExecutions(state.executions)[0];
        if (!target) return;

        if (state.confirmStop) state.askStop(target.id);
        else void state.stopExecution(target.id);
        return;
      }

      if (command && DIGIT.test(event.key)) {
        const section = sectionAt(Number(event.key) - 1);
        if (!section) return;

        event.preventDefault();
        useStore.getState().setSection(section.id);
        return;
      }

      if (event.key === "Escape" && useStore.getState().paletteOpen) {
        useStore.getState().closePalette();
        return;
      }

      if (inField(event.target)) return;

      if (event.key === "/") {
        event.preventDefault();
        useStore.getState().openPalette();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
