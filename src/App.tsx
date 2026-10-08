import { lazy, Suspense, useEffect } from "react";
import { useMotionSync } from "@/app/hooks/useMotionSync";
import { usePreferencesSync } from "@/features/app/usePreferencesSync";
import { PopoverShell } from "@/features/popover/PopoverShell";
import { useProjectSync } from "@/features/projects/useProjectSync";
import {
  applyDocumentAppearance,
  applyWindowChrome,
  resolveTheme,
  watchSystemTheme,
} from "@/lib/appearance";
import { useStore } from "./app/store";

const AppShell = lazy(() =>
  import("@/features/shell/AppShell").then((module) => ({
    default: module.AppShell,
  })),
);

export default function App() {
  const surface = useStore((s) => s.surface);
  const themePref = useStore((s) => s.themePref);
  const palette = useStore((s) => s.palette);
  const transparency = useStore((s) => s.transparency);

  useProjectSync();
  usePreferencesSync();
  useMotionSync();

  useEffect(() => {
    const resolved = resolveTheme(themePref);
    applyDocumentAppearance(themePref, resolved, transparency, palette);
    void applyWindowChrome(themePref, resolved, transparency);
  }, [themePref, palette, transparency]);

  useEffect(() => {
    if (themePref !== "system") return;
    return watchSystemTheme((resolved) => {
      applyDocumentAppearance("system", resolved, transparency, palette);
      void applyWindowChrome("system", resolved, transparency);
    });
  }, [themePref, palette, transparency]);

  return surface === "popover" ? (
    <PopoverShell />
  ) : (
    <Suspense fallback={<div className="pulso-window h-full bg-void" />}>
      <AppShell />
    </Suspense>
  );
}
