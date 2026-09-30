import {
  FolderSimpleIcon,
  GearSixIcon,
  ListBulletsIcon,
  SquaresFourIcon,
  TerminalWindowIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react";
import { Button } from "@zovaris/sephiro";
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
};

export function Sidebar() {
  const { t } = useI18n();
  const section = useStore((state) => state.section);
  const setSection = useStore((state) => state.setSection);
  const projects = useStore((state) => state.projects);
  const executions = useStore((state) => state.executions);
  const metrics = useStore((state) => state.metrics);
  const seenAt = useStore((state) => state.seenFailuresAt);

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
    <aside className="flex w-[228px] flex-none flex-col gap-0.5 border-r border-line bg-night px-2.5 pt-3.5 pb-2.5">
      <div className="px-1.5 pb-3">
        <p className="text-[12.5px] font-semibold tracking-[-0.01em]">
          {t("appName")}
        </p>
        <p className="mt-1 text-[11px] text-faint">
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
            {t(item.labelKey)}
            {flagged ? (
              <span
                className="pulso-dot ml-auto"
                data-s="failed"
                title={t("failuresWaiting", { count: unseen })}
              />
            ) : null}
            {count && !flagged ? (
              <span className="ml-auto text-[11px] text-faint tabular-nums">
                {count}
              </span>
            ) : null}
          </Button>
        );
      })}

      <div className="mt-auto border-t border-hairline px-1.5 pt-2.5 text-[11px] text-faint">
        {t("sectionHint")}
      </div>
    </aside>
  );
}
