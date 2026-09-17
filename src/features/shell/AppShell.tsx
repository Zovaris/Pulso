import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CommandPalette } from "@/features/shell/components/CommandPalette";
import { Sidebar } from "@/features/shell/components/Sidebar";
import { StatusBar } from "@/features/shell/components/StatusBar";
import { Titlebar } from "@/features/shell/components/Titlebar";
import { LogsSection } from "@/features/shell/sections/LogsSection";
import { OverviewSection } from "@/features/shell/sections/OverviewSection";
import { ProcessesSection } from "@/features/shell/sections/ProcessesSection";
import { ProjectsSection } from "@/features/shell/sections/ProjectsSection";
import { SettingsSection } from "@/features/shell/sections/SettingsSection";
import { useDesktopSync } from "@/features/shell/useDesktopSync";
import { useShellKeyboard } from "@/features/shell/useShellKeyboard";
import { REVEAL_DURATION, REVEAL_EASE } from "@/lib/motion";

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
        <button
          type="button"
          onClick={dismissNotice}
          className="pointer-events-auto max-w-[420px] truncate rounded-[8px] border border-line bg-panel px-3 py-2 text-left text-[11.5px] text-mist shadow-[0_12px_32px_rgb(0_0_0/0.4)]"
        >
          {notice}
        </button>
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
  useShellKeyboard();
  useDesktopSync();

  return (
    <div className="pulso-window relative flex h-full flex-col bg-void text-paper">
      <Titlebar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1">
          {section === "overview" ? <OverviewSection /> : null}
          {section === "projects" ? <ProjectsSection /> : null}
          {section === "processes" ? <ProcessesSection /> : null}
          {section === "logs" ? <LogsSection /> : null}
          {section === "settings" ? <SettingsSection /> : null}
        </main>
      </div>
      <StatusBar />
      <CommandPalette />
      <StopConfirmation />
      <ClearHistoryConfirmation />
      <Notice />
    </div>
  );
}
