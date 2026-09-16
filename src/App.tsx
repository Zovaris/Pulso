import { useEffect } from "react";
import { AppShell } from "@/features/app/AppShell";
import { PopoverShell } from "@/features/popover/PopoverShell";
import { useProjectSync } from "@/features/projects/useProjectSync";
import {
  applyDocumentAppearance,
  applyWindowChrome,
  resolveTheme,
} from "@/lib/appearance";
import { useStore } from "./app/store";

export default function App() {
  const surface = useStore((s) => s.surface);
  const themePref = useStore((s) => s.themePref);
  const transparency = useStore((s) => s.transparency);
  const hydrateAppearance = useStore((s) => s.hydrateAppearance);

  useProjectSync();

  useEffect(() => {
    void hydrateAppearance();
  }, [hydrateAppearance]);

  useEffect(() => {
    const resolved = resolveTheme(themePref);
    applyDocumentAppearance(themePref, resolved, transparency);
    void applyWindowChrome(resolved, transparency);
  }, [themePref, transparency]);

  useEffect(() => {
    if (themePref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = resolveTheme("system");
      applyDocumentAppearance("system", resolved, transparency);
      void applyWindowChrome(resolved, transparency);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themePref, transparency]);

  return surface === "popover" ? <PopoverShell /> : <AppShell />;
}
