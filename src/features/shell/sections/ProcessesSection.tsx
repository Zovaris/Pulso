import { StopIcon } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { Card } from "@/components/shared/Card";
import {
  byUptime,
  finishedExecutions,
  liveExecutions,
} from "@/features/desktop/session";
import { ProcessTable } from "@/features/shell/components/ProcessTable";

export function ProcessesSection() {
  const { t } = useI18n();
  const executions = useStore((state) => state.executions);
  const projects = useStore((state) => state.projects);
  const clearFinished = useStore((state) => state.clearFinished);
  const stopExecution = useStore((state) => state.stopExecution);

  const names = Object.fromEntries(
    projects.map((project) => [project.id, project.name]),
  );
  const live = byUptime(executions);
  const done = finishedExecutions(executions);
  const liveCount = liveExecutions(executions).length;

  return (
    <div className="pulso-pane flex min-w-0 flex-1 flex-col gap-3.5 overflow-auto px-6 py-5">
      <header className="flex items-start gap-4">
        <div>
          <h1 className="text-[16px] font-semibold tracking-[-0.015em]">
            {t("sectionProcesses")}
          </h1>
          <p className="mt-1 text-[12px] text-mist">{t("processesLede")}</p>
        </div>
        <div className="ml-auto flex flex-none items-center gap-2">
          <button
            type="button"
            disabled={done.length === 0}
            onClick={() => void clearFinished()}
            className="flex h-[28px] items-center rounded-[7px] border border-line px-3 text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper disabled:cursor-default disabled:opacity-40"
          >
            {t("clearFinished")}
          </button>
          <button
            type="button"
            disabled={liveCount === 0}
            onClick={() => {
              for (const execution of live) void stopExecution(execution.id);
            }}
            className="flex h-[28px] items-center gap-1.5 rounded-[7px] border border-line px-3 text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper disabled:cursor-default disabled:opacity-40"
          >
            <StopIcon size={12} weight="fill" />
            {t("stopAll")}
          </button>
        </div>
      </header>

      <ProcessTable
        executions={executions}
        projects={names}
        variant="all"
        title={t("everythingThisSession")}
        meta={t("sampledEvery")}
        empty={t("noExecutions")}
      />

      <Card title={t("howItWorks")}>
        <p className="px-3.5 py-3 text-[11.5px] leading-5 text-faint">
          {t("processesNote")}
        </p>
      </Card>
    </div>
  );
}
