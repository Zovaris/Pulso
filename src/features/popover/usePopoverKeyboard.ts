import { useEffect } from "react";
import { useStore } from "@/app/store";
import { onPopoverPrepare } from "@/lib/events";
import { closePopover } from "@/lib/tauri";

export function usePopoverKeyboard() {
  const moveCursor = useStore((state) => state.moveCursor);
  const stepCursor = useStore((state) => state.stepCursor);
  const activateCursor = useStore((state) => state.activateCursor);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return;

      switch (event.key) {
        case "ArrowDown":
          moveCursor(1);
          break;
        case "ArrowUp":
          moveCursor(-1);
          break;
        case "ArrowRight":
          stepCursor("in");
          break;
        case "ArrowLeft":
          stepCursor("out");
          break;
        case "Enter":
          activateCursor();
          break;
        case "Escape":
          void closePopover();
          break;
        default:
          return;
      }

      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    const prepared = onPopoverPrepare(() =>
      useStore.getState().setCursor(null),
    );

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      void prepared.then((unlisten) => unlisten());
    };
  }, [activateCursor, moveCursor, stepCursor]);
}
