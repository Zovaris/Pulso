import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  type ComponentType,
  type LazyExoticComponent,
  lazy,
  Suspense,
  useEffect,
} from "react";
import { Button } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorNote } from "@/components/shared/ErrorNote";
import { CommandPalette } from "@/features/shell/components/CommandPalette";
import { Sidebar } from "@/features/shell/components/Sidebar";
import { StatusBar } from "@/features/shell/components/StatusBar";
import { Titlebar } from "@/features/shell/components/Titlebar";
import { useDesktopSync } from "@/features/shell/useDesktopSync";
import { useShellKeyboard } from "@/features/shell/useShellKeyboard";
import { REVEAL_DURATION, REVEAL_EASE } from "@/lib/motion";
import type { SectionId } from "@/app/stores/types";

const LOADERS: Record<SectionId, () => Promise<{ default: ComponentType }>> = {
  overview: () =>
    import("@/features/shell/sections/OverviewSection").then((module) => ({
      default: module.OverviewSection,
    })),
  projects: () =>
    import("@/features/shell/sections/ProjectsSection").then((module) => ({
      default: module.ProjectsSection,
    })),
  commands: () =>
    import("@/features/shell/sections/CommandsSection").then((module) => ({
      default: module.CommandsSection,
    })),
  processes: () =>
    import("@/features/shell/sections/ProcessesSection").then((module) => ({
      default: module.ProcessesSection,
    })),
  ports: () =>
    import("@/features/shell/sections/PortsSection").then((module) => ({
      default: module.PortsSection,
    })),
  logs: () =>
    import("@/features/shell/sections/LogsSection").then((module) => ({
      default: module.LogsSection,
    })),
  settings: () =>
    import("@/features/shell/sections/SettingsSection").then((module) => ({
      default: module.SettingsSection,
    })),
};

const SECTION_VIEWS = Object.fromEntries(
  Object.entries(LOADERS).map(([id, load]) => [id, lazy(load)]),
) as Record<SectionId, LazyExoticComponent<ComponentType>>;

/** Loads every section once the window is idle, so the first visit to one never waits. */
function usePrefetchSections() {
  useEffect(() => {
    const prefetch = () => {
      for (const load of Object.values(LOADERS)) void load();
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(prefetch, { timeout: 2000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(prefetch, 300);
    return () => window.clearTimeout(handle);
  }, []);
}

function Notice() {
  const notice = useStore((state) => state.notice);
  const dismissNotice = useStore((state) => state.dismissNotice);
  const [box] = useAutoAnimate<HTMLDivElement>({
    duration: REVEAL_DURATION,
    easing: REVEAL_EASE,
  });

  return (
    <div
      ref={box}
      className="pointer-events-none absolute right-4 bottom-10 z-30"
    >
      {notice ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={dismissNotice}
          className="pulso-row-fill-bare pointer-events-auto max-w-[420px] items-start px-3 py-2 text-left text-[11.5px] shadow-[0_12px_32px_rgb(0_0_0/0.4)]"
        >
          {notice}
        </Button>
      ) : null}
    </div>
  );
}

function StopConfirmation() {
  const { t } = useI18n();
  const confirmingStop = useStore((state) => state.confirmingStop);
  const askStop = useStore((state) => state.askStop);
  const stopExecution = useStore((state) => state.stopExecution);
  const execution = useStore((state) =>
    state.executions.find((entry) => entry.id === confirmingStop),
  );

  if (confirmingStop === null || !execution) return null;

  return (
    <ConfirmDialog
      title={t("confirmStopTitle")}
      body={t("confirmStopBody", { label: execution.label })}
      confirmLabel={t("stopCommand")}
      cancelLabel={t("cancel")}
      onCancel={() => askStop(null)}
      onConfirm={() => {
        askStop(null);
        void stopExecution(execution.id);
      }}
    />
  );
}

function ClearHistoryConfirmation() {
  const { t } = useI18n();
  const confirming = useStore((state) => state.confirmingHistory);
  const askClearHistory = useStore((state) => state.askClearHistory);
  const clearHistory = useStore((state) => state.clearHistory);

  if (!confirming) return null;

  return (
    <ConfirmDialog
      title={t("confirmClearHistoryTitle")}
      body={t("confirmClearHistoryBody")}
      confirmLabel={t("clearHistory")}
      cancelLabel={t("cancel")}
      onCancel={() => askClearHistory(false)}
      onConfirm={() => void clearHistory()}
    />
  );
}

export function AppShell() {
  const section = useStore((state) => state.section);
  const error = useStore((state) => state.projectError);
  const dismissError = useStore((state) => state.dismissProjectError);
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const inspectorOpen = useStore((state) => state.inspectorOpen);
  const View = SECTION_VIEWS[section];
  useShellKeyboard();
  useDesktopSync();
  usePrefetchSections();

  return (
    <div
      data-sidebar={sidebarOpen ? "open" : "closed"}
      data-inspector={inspectorOpen ? "open" : "closed"}
      className="pulso-window relative flex h-full min-h-0 flex-col overflow-hidden bg-void text-paper"
    >
      <Titlebar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="pulso-workspace flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <Suspense fallback={<div className="pulso-pane flex-1" />}>
            <View />
          </Suspense>
        </main>
      </div>
      {error && section !== "projects" ? (
        <div className="px-4 pb-2">
          <ErrorNote error={error} onDismiss={dismissError} />
        </div>
      ) : null}
      <StatusBar />
      <CommandPalette />
      <StopConfirmation />
      <ClearHistoryConfirmation />
      <Notice />
    </div>
  );
}
