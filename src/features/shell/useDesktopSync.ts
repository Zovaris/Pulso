import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { useEffect } from "react";
import { useStore } from "@/app/store";
import { onExecutionMetrics } from "@/lib/events";
import { listen } from "@tauri-apps/api/event";
import { SECTIONS } from "@/features/shell/sections";
import type { SectionId } from "@/app/stores/types";
import { isTauri } from "@/lib/tauri";

/**
 * macOS only shows a notification for an app the user has allowed, and the
 * question is asked once. Answering it while the window is open is the least
 * surprising moment for it.
 */
async function askToNotify() {
  if (!isTauri()) return;

  try {
    if (await isPermissionGranted()) return;
    await requestPermission();
  } catch {}
}

/**
 * The desktop is the only surface that shows resources, so it is the only one
 * that listens for them, and it asks for the editors and the data folder once,
 * when it opens.
 */
export function useDesktopSync() {
  const loadEditors = useStore((state) => state.loadEditors);
  const loadDataStatus = useStore((state) => state.loadDataStatus);
  const applyMetrics = useStore((state) => state.applyMetrics);

  useEffect(() => {
    void loadEditors();
    void loadDataStatus();
    void askToNotify();

    const metrics = onExecutionMetrics(applyMetrics);
    const navigation = isTauri()
      ? listen<SectionId>("navigation://section", ({ payload }) => {
          if (SECTIONS.some((section) => section.id === payload))
            useStore.getState().setSection(payload);
        })
      : Promise.resolve(() => {});

    return () => {
      void navigation.then((unlisten) => unlisten()).catch(() => undefined);
      void metrics.then((unlisten) => unlisten());
    };
  }, [loadEditors, loadDataStatus, applyMetrics]);
}
