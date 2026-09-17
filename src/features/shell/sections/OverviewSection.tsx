import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { isActiveState } from "@/features/executions/execution";

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[9px] border border-line bg-panel px-3 pt-2.5 pb-2">
      <p className="text-[11px] text-mist">{label}</p>
      <p className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em] tabular-nums">
        {value}
      </p>
    </div>
  );
}

export function OverviewSection() {
  const { t } = useI18n();
  const projectCount = useStore((state) => state.projects.length);
  const commandCount = useStore((state) =>
    Object.values(state.scans).reduce(
      (total, scan) => total + scan.commands.length,
      0,
    ),
  );
  const liveCount = useStore(
    (state) =>
      state.executions.filter((execution) => isActiveState(execution.state))
        .length,
  );

  return (
    <div className="px-9 py-8">
      <h1 className="text-[17px] font-semibold tracking-[-0.015em]">
        {t("sectionOverview")}
      </h1>
      <p className="mt-1.5 text-[12.5px] text-mist">{t("overviewLede")}</p>

      <div className="mt-6 grid max-w-[560px] grid-cols-3 gap-2.5">
        <Tile label={t("projects")} value={projectCount} />
        <Tile label={t("tileCommands")} value={commandCount} />
        <Tile label={t("tileRunning")} value={liveCount} />
      </div>

      <p className="mt-7 max-w-[420px] text-[12.5px] leading-6 text-mist">
        {liveCount === 0
          ? t("noneRunning")
          : t("runningCount", { count: liveCount })}
      </p>
      <p className="mt-2 max-w-[420px] text-[12px] leading-6 text-faint">
        {t("comingMetrics")}
      </p>
    </div>
  );
}
