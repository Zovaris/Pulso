import { useEffect } from "react";
import { useStore } from "@/app/store";
import {
  onCommandFlagsChanged,
  onCommandsChanged,
  onCommandGroupsChanged,
  onCustomCommandsChanged,
  onExecutionChanged,
  onExecutionsRemoved,
  onLogAppended,
  onPopoverPrepare,
  onProjectsChanged,
} from "@/lib/events";

export function useProjectSync() {
  const loadCustomCommands = useStore((state) => state.loadCustomCommands);
  const applyCustomCommands = useStore((state) => state.applyCustomCommands);
  const loadCommandGroups = useStore((state) => state.loadCommandGroups);
  const applyCommandGroups = useStore((state) => state.applyCommandGroups);
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
      if (state.selectedExecutionId !== null)
        void state.loadLogs(state.selectedExecutionId);
    };
    window.addEventListener("focus", refreshLogs);
    const subscriptions = [
      onProjectsChanged(applyProjects),
      onCustomCommandsChanged(applyCustomCommands),
      onCommandGroupsChanged(applyCommandGroups),
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
        void loadCustomCommands();
        void loadCommandGroups();
        void loadProjects();
        void loadExecutions();
      })
      .catch(() => {
        if (!cancelled) {
          void loadCustomCommands();
          void loadCommandGroups();
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
    loadCustomCommands,
    applyCustomCommands,
    loadCommandGroups,
    applyCommandGroups,
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
