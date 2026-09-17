import {
  FolderSimpleIcon,
  GearSixIcon,
  ListBulletsIcon,
  SquaresFourIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import type { SectionId } from "@/app/stores/types";
import { isActiveState } from "@/features/executions/execution";
import { SECTIONS } from "@/features/shell/sections";

const ICONS: Record<SectionId, typeof SquaresFourIcon> = {
  overview: SquaresFourIcon,
  projects: FolderSimpleIcon,
  processes: ListBulletsIcon,
  logs: TextAlignLeftIcon,
  settings: GearSixIcon,
};

export function Sidebar() {
  const { t } = useI18n();
  const section = useStore((state) => state.section);
  const setSection = useStore((state) => state.setSection);
  const projectCount = useStore((state) => state.projects.length);
  const liveCount = useStore(
    (state) =>
      state.executions.filter((execution) => isActiveState(execution.state))
        .length,
  );

  const counts: Partial<Record<SectionId, number>> = {
    projects: projectCount,
    processes: liveCount,
  };

  return (
    <aside className="flex w-[228px] flex-none flex-col gap-0.5 border-r border-line bg-night px-2.5 pt-3.5 pb-2.5">
      <div className="px-1.5 pb-3">
        <p className="text-[12.5px] font-semibold tracking-[-0.01em]">
          {t("appName")}
        </p>
        <p className="mt-1 text-[11px] text-mist">
          {liveCount === 0
            ? t("noneRunning")
            : t("runningCount", { count: liveCount })}
        </p>
      </div>

      {SECTIONS.map((item) => {
        const Icon = ICONS[item.id];
        const active = item.id === section;
        const count = counts[item.id];

        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => setSection(item.id)}
            className={`flex h-[30px] items-center gap-2.5 rounded-[7px] px-2 text-left text-[12.5px] transition-colors duration-[120ms] ${
              active
                ? "bg-fill font-medium text-paper"
                : "text-mist hover:bg-hover hover:text-paper"
            }`}
          >
            <Icon size={14} className="flex-none" />
            {t(item.labelKey)}
            {count ? (
              <span className="ml-auto text-[11px] text-faint tabular-nums">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}

      <div className="mt-auto border-t border-hairline px-1.5 pt-2.5 text-[11px] text-faint">
        {t("sectionHint")}
      </div>
    </aside>
  );
}
