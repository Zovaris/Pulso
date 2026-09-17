import { useEffect } from "react";
import { useStore } from "@/app/store";
import { sectionAt } from "@/features/shell/sections";

const DIGIT = /^[1-9]$/;

export function useShellKeyboard() {
  const setSection = useStore((state) => state.setSection);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      if (!DIGIT.test(event.key)) return;

      const section = sectionAt(Number(event.key) - 1);
      if (!section) return;

      setSection(section.id);
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSection]);
}
