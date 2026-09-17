import { useEffect } from "react";
import { useStore } from "@/app/store";
import {
  onCommandFlagsChanged,
  onCommandsChanged,
  onExecutionChanged,
  onLogAppended,
  onProjectsChanged,
} from "@/lib/events";

export function useProjectSync() {
  const loadProjects = useStore((state) => state.loadProjects);
  const applyProjects = useStore((state) => state.applyProjects);
  const applyScan = useStore((state) => state.applyScan);
  const applyFlags = useStore((state) => state.applyFlags);
  const loadExecutions = useStore((state) => state.loadExecutions);
  const applyExecution = useStore((state) => state.applyExecution);
  const applyLogs = useStore((state) => state.applyLogs);

  useEffect(() => {
    void loadProjects();
    void loadExecutions();

    const subscriptions = [
      onProjectsChanged(applyProjects),
      onCommandsChanged(applyScan),
      onCommandFlagsChanged(applyFlags),
      onExecutionChanged(applyExecution),
      onLogAppended(applyLogs),
    ];

    return () => {
      for (const subscription of subscriptions) {
        void subscription.then((unlisten) => unlisten());
      }
    };
  }, [
    loadProjects,
    loadExecutions,
    applyProjects,
    applyScan,
    applyFlags,
    applyExecution,
    applyLogs,
  ]);
}
