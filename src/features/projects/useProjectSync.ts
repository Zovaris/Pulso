import { useEffect } from "react";
import { useStore } from "@/app/store";
import {
  onCommandsChanged,
  onExecutionChanged,
  onProjectsChanged,
} from "@/lib/events";

export function useProjectSync() {
  const loadProjects = useStore((state) => state.loadProjects);
  const applyProjects = useStore((state) => state.applyProjects);
  const applyScan = useStore((state) => state.applyScan);
  const loadExecutions = useStore((state) => state.loadExecutions);
  const applyExecution = useStore((state) => state.applyExecution);

  useEffect(() => {
    void loadProjects();
    void loadExecutions();

    const subscriptions = [
      onProjectsChanged(applyProjects),
      onCommandsChanged(applyScan),
      onExecutionChanged(applyExecution),
    ];

    return () => {
      for (const subscription of subscriptions) {
        void subscription.then((unlisten) => unlisten());
      }
    };
  }, [loadProjects, loadExecutions, applyProjects, applyScan, applyExecution]);
}
