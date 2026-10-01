import {
  FolderSimpleIcon,
  GearSixIcon,
  ListBulletsIcon,
  SidebarSimpleIcon,
  SquaresFourIcon,
  TerminalWindowIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react";
import { Button } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import type { SectionId } from "@/app/stores/types";
import { IconTool } from "@/components/shared/IconTool";
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
  const toggleSidebar = useStore((state) => state.toggleSidebar);

  const live = liveExecutions(executions);
  const unseen = failures(executions).filter(
    (execution) => (execution.endedAt ?? 0) > seenAt,
  ).length;
  const memory = formatMemory(totalMemory(Object.values(metrics)));

  const counts: Partial<Record<SectionId, number>> = {
    projects: projects.length,
    processes: live.length,
  };

  return (
    <aside
      className="pulso-sidebar flex-none border-r border-line bg-night"
      inert={!sidebarOpen}
    >
      <div className="pulso-sidebar__inner flex flex-col gap-0.5 px-2.5 pt-3.5 pb-2.5">
        <div className="px-1.5 pb-3">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold tracking-[-0.01em]">
              {t("appName")}
            </p>
            <IconTool
              icon={SidebarSimpleIcon}
              label={t("hideSidebar")}
              onClick={toggleSidebar}
              size={12}
            />
          </div>
          <p className="mt-1 truncate text-[11px] text-faint">
            {live.length === 0
              ? t("noneRunning")
              : t("runningMemory", { count: live.length, memory })}
          </p>
        </div>

        {SECTIONS.map((item) => {
          const Icon = ICONS[item.id];
          const active = item.id === section;
          const count = counts[item.id];
          const flagged = item.id === "processes" && unseen > 0;

          return (
            <Button
              key={item.id}
              type="button"
              size="md"
              variant="quiet"
              aria-current={active ? "page" : undefined}
              onClick={() => setSection(item.id)}
              className={`pulso-nav ${active ? "pulso-nav-active" : ""}`}
            >
              <Icon size={14} className="flex-none" />
              <span className="min-w-0 flex-1 truncate">
                {t(item.labelKey)}
              </span>
              {flagged ? (
                <span
                  className="pulso-dot flex-none"
                  data-s="failed"
                  title={t("failuresWaiting", { count: unseen })}
                />
              ) : null}
              {count && !flagged ? (
                <span className="flex-none text-[11px] text-faint tabular-nums">
                  {count}
                </span>
              ) : null}
            </Button>
          );
        })}

        <div className="mt-auto border-t border-hairline px-1.5 pt-2.5 text-[11px] text-faint">
          {t("sectionHint")}
        </div>
      </div>
    </aside>
  );
}
