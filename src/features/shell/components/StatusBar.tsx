import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import {
  formatMemory,
  totalCpu,
  totalMemory,
} from "@/features/desktop/metrics";
import { liveExecutions, openPorts } from "@/features/desktop/session";

export function StatusBar() {
  const { t } = useI18n();
  const executions = useStore((state) => state.executions);
  const metrics = useStore((state) => state.metrics);
  const section = useStore((state) => state.section);
  const live = liveExecutions(executions);
  const samples = Object.values(metrics);
  const ports = openPorts(executions);

  return (
    <footer className="flex h-[30px] flex-none items-center gap-3 border-t border-line bg-night px-3.5 text-[11px] text-faint">
      <span>
        {live.length === 0
          ? t("noneRunning")
          : t("runningSummary", {
              count: live.length,
              memory: formatMemory(totalMemory(samples)),
              cpu: Math.round(totalCpu(samples)),
            })}
      </span>
      {ports.length > 0 ? (
        <>
          <span className="h-[12px] w-px bg-line" />
          <span className="tabular-nums">
            {t("portsSummary", { ports: ports.join(", ") })}
          </span>
        </>
      ) : null}

      <span className="ml-auto">
        {t(`hint${section[0].toUpperCase()}${section.slice(1)}`)}
      </span>
      <span className="h-[12px] w-px bg-line" />
      <span>{t("appName")} 0.1.0</span>
    </footer>
  );
}
