import { useEffect } from "react";
import { useStore } from "@/app/store";
import { onCommandsChanged, onProjectsChanged } from "@/lib/events";

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
