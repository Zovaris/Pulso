import { useEffect } from "react";
import { useStore } from "@/app/store";
import {
  onCommandFlagsChanged,
  onCommandsChanged,
  onExecutionChanged,
  onExecutionsRemoved,
  onLogAppended,
  onPopoverPrepare,
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
  const removeExecutions = useStore((state) => state.removeExecutions);

  useEffect(() => {
    let cancelled = false;
    const refreshLogs = () => {
      const state = useStore.getState();
      const selected = state.selectedExecutionId;
      const open = [...state.executions]
        .reverse()
        .find(
          (execution) =>
            `${execution.projectId}:${execution.commandId}` ===
            state.openLogKey,
        );
      if (selected !== null) void state.loadLogs(selected);
      if (open) void state.loadLogs(open.id);
    };
    window.addEventListener("focus", refreshLogs);
    const subscriptions = [
      onProjectsChanged(applyProjects),
      onCommandsChanged(applyScan),
      onCommandFlagsChanged(applyFlags),
      onExecutionChanged(applyExecution),
      onExecutionsRemoved(removeExecutions),
      onLogAppended(applyLogs),
      onPopoverPrepare(refreshLogs),
    ];

    void Promise.all(subscriptions)
      .then(() => {
        if (cancelled) return;
        void loadProjects();
        void loadExecutions();
      })
      .catch(() => {
        if (!cancelled) {
          void loadProjects();
          void loadExecutions();
        }
      });

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshLogs);
      for (const subscription of subscriptions) {
        void subscription.then((unlisten) => unlisten()).catch(() => undefined);
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
    removeExecutions,
  ]);
}
