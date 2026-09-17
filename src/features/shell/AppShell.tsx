import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { PendingSection } from "@/features/shell/components/PendingSection";
import { Sidebar } from "@/features/shell/components/Sidebar";
import { StatusBar } from "@/features/shell/components/StatusBar";
import { Titlebar } from "@/features/shell/components/Titlebar";
import { SECTIONS } from "@/features/shell/sections";
import { OverviewSection } from "@/features/shell/sections/OverviewSection";
import { ProjectsSection } from "@/features/shell/sections/ProjectsSection";
import { SettingsSection } from "@/features/shell/sections/SettingsSection";
import { useShellKeyboard } from "@/features/shell/useShellKeyboard";

export function AppShell() {
  const { t } = useI18n();
  const section = useStore((state) => state.section);
  useShellKeyboard();

  const current = SECTIONS.find((item) => item.id === section);

  return (
    <div className="flex h-full flex-col bg-void text-paper">
      <Titlebar title={t(current?.labelKey ?? "appName")} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-auto">
          {section === "overview" ? <OverviewSection /> : null}
          {section === "projects" ? <ProjectsSection /> : null}
          {section === "processes" ? (
            <PendingSection
              titleKey="sectionProcesses"
              noteKey="processesNote"
            />
          ) : null}
          {section === "logs" ? (
            <PendingSection titleKey="sectionLogs" noteKey="logsNote" />
          ) : null}
          {section === "settings" ? <SettingsSection /> : null}
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
