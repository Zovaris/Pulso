import {
  FolderSimpleIcon,
  GearSixIcon,
  ListBulletsIcon,
  PlugsConnectedIcon,
  SquaresFourIcon,
  TerminalWindowIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react";
import { Sidebar as NavSidebar, type SidebarSection } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import type { SectionId } from "@/app/stores/types";
import { formatMemory, totalMemory } from "@/features/desktop/metrics";
import { failures, liveExecutions } from "@/features/desktop/session";
import { SECTIONS } from "@/features/shell/sections";

const ICONS: Record<SectionId, typeof SquaresFourIcon> = {
  overview: SquaresFourIcon,
  projects: FolderSimpleIcon,
  processes: ListBulletsIcon,
  logs: TextAlignLeftIcon,
  settings: GearSixIcon,
  commands: TerminalWindowIcon,
  ports: PlugsConnectedIcon,
};

export function Sidebar() {
  const { t } = useI18n();
  const section = useStore((state) => state.section);
  const setSection = useStore((state) => state.setSection);
  const projects = useStore((state) => state.projects);
  const executions = useStore((state) => state.executions);
  const metrics = useStore((state) => state.metrics);
  const seenAt = useStore((state) => state.seenFailuresAt);
  const sidebarOpen = useStore((state) => state.sidebarOpen);

  const live = liveExecutions(executions);
  const unseen = failures(executions).filter(
    (execution) => (execution.endedAt ?? 0) > seenAt,
  ).length;
  const memory = formatMemory(totalMemory(Object.values(metrics)));

  const counts: Partial<Record<SectionId, number>> = {
    projects: projects.length,
    processes: live.length,
  };

  const sections: SidebarSection[] = [
    {
      items: SECTIONS.map((item) => {
        const Icon = ICONS[item.id];
        const count = counts[item.id];
        const flagged = item.id === "processes" && unseen > 0;

        return {
          value: item.id,
          label: t(item.labelKey),
          icon: <Icon size={14} />,
          badge: flagged ? (
            <span
              className="pulso-dot"
              data-s="failed"
              title={t("failuresWaiting", { count: unseen })}
            />
          ) : count ? (
            <span className="text-[11px] text-faint tabular-nums">{count}</span>
          ) : undefined,
        };
      }),
    },
  ];

  return (
    <NavSidebar
      className="pulso-sidebar"
      ariaLabel={t("appName")}
      sections={sections}
      value={section}
      onSelect={(value) => setSection(value as SectionId)}
      collapsed={!sidebarOpen}
      collapsedMode="rail"
      header={
        <>
          <p className="truncate text-[12.5px] font-semibold tracking-[-0.01em]">
            {t("appName")}
          </p>
          <p className="mt-1 truncate text-[11px] text-faint">
            {live.length === 0
              ? t("noneRunning")
              : t("runningMemory", { count: live.length, memory })}
          </p>
        </>
      }
      footer={
        <span className="text-[11px] text-faint">{t("sectionHint")}</span>
      }
    />
  );
}
