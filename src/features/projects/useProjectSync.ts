import { useEffect } from "react";
import { useStore } from "@/app/store";
import { onCommandsChanged, onProjectsChanged } from "@/lib/events";

/**
 * One snapshot read, then events only.
 *
 * Freshness on open is Rust's job: it re-reads projects and re-scans their
 * manifests when a surface becomes visible and pushes the result, so nothing
 * here polls or refreshes on a timer.
 */
export function useProjectSync() {
  const loadProjects = useStore((state) => state.loadProjects);
  const applyProjects = useStore((state) => state.applyProjects);
  const applyScan = useStore((state) => state.applyScan);

  useEffect(() => {
    void loadProjects();

    const subscriptions = [
      onProjectsChanged(applyProjects),
      onCommandsChanged(applyScan),
    ];

    return () => {
      for (const subscription of subscriptions) {
        void subscription.then((unlisten) => unlisten());
      }
    };
  }, [loadProjects, applyProjects, applyScan]);
}
