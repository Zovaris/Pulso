import {
  CpuIcon,
  FolderSimplePlusIcon,
  GaugeIcon,
  PlugsConnectedIcon,
  StopIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { Card } from "@/components/shared/Card";
import { Sparkline } from "@/components/shared/Sparkline";
import {
  formatCpu,
  formatMemory,
  totalCpu,
  totalMemory,
} from "@/features/desktop/metrics";
import { byUptime, failures, openPorts } from "@/features/desktop/session";
import { useAddProject } from "@/features/projects/useAddProject";
import { ProcessInspector } from "@/features/shell/components/Inspector";
import { ProcessTable } from "@/features/shell/components/ProcessTable";

function Tile({
  icon,
  label,
  value,
  unit,
  note,
  chart,
  tone,
}: {
  icon: typeof CpuIcon;
  label: string;
  value: string;
  unit?: string;
  note?: string;
  chart?: number[];
  tone?: "alarm";
}) {
  const Icon = icon;

  return (
    <div className="rounded-[10px] border border-line bg-panel px-3 pt-2.5 pb-2">
      <p className="flex items-center gap-1.5 text-[11px] text-faint">
        <Icon size={12} />
        {label}
      </p>
      <p
        className={`mt-1.5 text-[20px] font-semibold tracking-[-0.02em] tabular-nums ${
          tone === "alarm" ? "text-alarm" : ""
        }`}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-[11px] font-normal text-faint">
            {unit}
          </span>
        ) : null}
      </p>
      {chart ? <Sparkline values={chart} /> : null}
      {note ? (
        <p className="mt-1.5 truncate text-[11px] text-faint">{note}</p>
      ) : null}
    </div>
  );
}

function Notice() {
  const { t } = useI18n();
  const executions = useStore((state) => state.executions);
  const setSection = useStore((state) => state.setSection);
  const projects = useStore((state) => state.projects);
  const failed = failures(executions)[0];

  if (!failed) return null;

  const name = projects.find(
    (project) => project.id === failed.projectId,
  )?.name;

  return (
    <div className="flex items-center gap-2.5 rounded-[9px] border border-line bg-panel px-3 py-2">
      <WarningOctagonIcon size={14} className="flex-none text-alarm" />
      <p className="min-w-0 flex-1 truncate text-[12px]">
        {t("failedNotice", {
          target: `${name ?? `#${failed.projectId}`} · ${failed.label}`,
          code: failed.exitCode ?? "—",
        })}
      </p>
      <button
        type="button"
        onClick={() => {
          setSection("logs");
        }}
        className="h-[24px] flex-none rounded-[6px] border border-line px-2 text-[11.5px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
      >
        {t("seeLogs")}
      </button>
    </div>
  );
}

export function OverviewSection() {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const executions = useStore((state) => state.executions);
  const metrics = useStore((state) => state.metrics);
  const histories = useStore((state) => state.histories);
  const clearFinished = useStore((state) => state.clearFinished);
  const stopExecution = useStore((state) => state.stopExecution);
  const addProject = useAddProject();

  const live = byUptime(executions);
  const samples = Object.values(metrics);
  const ports = openPorts(executions);
  const failed = failures(executions);
  const names = Object.fromEntries(
    projects.map((project) => [project.id, project.name]),
  );
  const cpuHistory = histories[live[0]?.id ?? -1] ?? [];
  const memoryHistory = Object.values(histories).flatMap((history) =>
    history.map((value) => value * 64),
  );

  return (
    <>
      <div className="pulso-pane flex min-w-0 flex-1 flex-col gap-3.5 overflow-auto px-6 py-5">
        <header className="flex items-start gap-4">
          <div>
            <h1 className="text-[16px] font-semibold tracking-[-0.015em]">
              {t("sectionOverview")}
            </h1>
            <p className="mt-1 text-[12px] text-mist">{t("overviewLede")}</p>
          </div>
          <div className="ml-auto flex flex-none items-center gap-2">
            <button
              type="button"
              disabled={live.length === 0}
              onClick={() => {
                for (const execution of live) void stopExecution(execution.id);
              }}
              className="flex h-[28px] items-center gap-1.5 rounded-[7px] border border-line px-3 text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper disabled:cursor-default disabled:opacity-40"
            >
              <StopIcon size={12} weight="fill" />
              {t("stopAll")}
            </button>
            <button
              type="button"
              onClick={() => void addProject()}
              className="flex h-[28px] items-center gap-1.5 rounded-[7px] bg-accent px-3 text-[12px] text-white transition-colors duration-[120ms] hover:bg-accent-hover"
            >
              <FolderSimplePlusIcon size={13} />
              {t("addProject")}
            </button>
          </div>
        </header>

        <Notice />

        <div className="grid grid-cols-4 gap-2.5">
          <Tile
            icon={GaugeIcon}
            label={t("tileLive")}
            value={String(live.length)}
            note={
              live.length === 0
                ? t("noneRunning")
                : `${formatCpu(totalCpu(samples))} CPU`
            }
            chart={cpuHistory}
          />
          <Tile
            icon={CpuIcon}
            label={t("memory")}
            value={formatMemory(totalMemory(samples)).split(" ")[0]}
            unit={formatMemory(totalMemory(samples)).split(" ")[1]}
            chart={memoryHistory.slice(-60)}
          />
          <Tile
            icon={PlugsConnectedIcon}
            label={t("tilePorts")}
            value={String(ports.length)}
            note={ports.length === 0 ? t("nothingListening") : ports.join(", ")}
          />
          <Tile
            icon={WarningOctagonIcon}
            label={t("tileFailures")}
            value={String(failed.length)}
            tone={failed.length > 0 ? "alarm" : undefined}
            note={
              failed.length === 0
                ? t("noFailures")
                : `${names[failed[0].projectId] ?? ""} · ${failed[0].label}`
            }
          />
        </div>

        <ProcessTable
          executions={live}
          projects={names}
          variant="live"
          title={t("liveProcesses")}
          meta={t("sampledEvery")}
          empty={t("noLiveProcesses")}
        />

        <Card title={t("sessionSummary")}>
          <div className="flex items-center gap-3 px-3.5 py-2.5 text-[11.5px] text-faint">
            <span>{t("executionCount", { count: executions.length })}</span>
            <span className="h-[12px] w-px bg-line" />
            <span>{t("exitCodeHint")}</span>
            <button
              type="button"
              onClick={() => void clearFinished()}
              className="ml-auto h-[24px] rounded-[6px] border border-line px-2 text-[11.5px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
            >
              {t("clearFinished")}
            </button>
          </div>
        </Card>
      </div>

      <ProcessInspector />
    </>
  );
}
