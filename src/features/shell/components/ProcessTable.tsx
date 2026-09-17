import { ArrowClockwiseIcon, StopIcon } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { Card, CardEmpty } from "@/components/shared/Card";
import { IconTool } from "@/components/shared/IconTool";
import {
  formatCpu,
  formatMemory,
  memoryRatio,
} from "@/features/desktop/metrics";
import { exitBadge } from "@/features/desktop/session";
import { formatDuration, useElapsed } from "@/features/executions/execution";
import type { Execution } from "@/lib/types";

function stateOf(execution: Execution): string {
  return execution.state;
}

export function statusKey(state: Execution["state"]): string {
  switch (state) {
    case "starting":
      return "stateStarting";
    case "running":
      return "stateRunning";
    case "stopping":
      return "stateStopping";
    case "exited":
      return "stateExited";
    default:
      return "stateFailed";
  }
}

function ProcessRow({
  execution,
  projectName,
  variant,
}: {
  execution: Execution;
  projectName: string;
  variant: "live" | "all";
}) {
  const { t } = useI18n();
  const live = stateOf(execution);
  const active =
    live === "running" || live === "starting" || live === "stopping";
  const metrics = useStore((state) => state.metrics[execution.id]);
  const selected = useStore(
    (state) => state.selectedExecutionId === execution.id,
  );
  const select = useStore((state) => state.select);
  const restartExecution = useStore((state) => state.restartExecution);
  const askStop = useStore((state) => state.askStop);
  const confirmStop = useStore((state) => state.confirmStop);
  const stopExecution = useStore((state) => state.stopExecution);
  const elapsed = useElapsed(execution.startedAt, active);
  const exit = exitBadge(execution);
  const ports = execution.ports.map((port) => port.port);
  const finishedAt = execution.endedAt ?? Date.now();
  const duration = active
    ? elapsed
    : formatDuration(finishedAt - execution.startedAt);

  const stop = () => {
    if (confirmStop) {
      askStop(execution.id);
      return;
    }

    void stopExecution(execution.id);
  };

  return (
    <div
      className="pulso-proc pulso-row pulso-row-proc px-3.5 py-2"
      data-selected={selected}
    >
      <button
        type="button"
        onClick={() => select(execution.id)}
        className="flex min-w-0 items-center gap-2 text-left"
      >
        <i className="pulso-dot" data-s={live} />
        <span className="min-w-0">
          <span className="block truncate text-[12px]">
            {projectName} · {execution.label}
          </span>
          <span className="block truncate text-[11px] text-faint tabular-nums">
            {execution.pid === null
              ? t(statusKey(execution.state))
              : `PID ${execution.pid}`}
          </span>
        </span>
      </button>

      <div
        className="min-w-0 truncate font-mono text-[11.5px] text-mist"
        title={[execution.program, ...execution.args].join(" ")}
      >
        {[execution.program, ...execution.args].join(" ")}
      </div>

      <div className="grid grid-cols-[44px_40px_minmax(0,1fr)_56px] items-center gap-2 text-[11.5px] tabular-nums">
        <span className="text-mist">{duration}</span>
        <span className="text-mist">
          {metrics ? formatCpu(metrics.cpu) : "—"}
        </span>
        <span
          className="pulso-meter"
          data-tone={
            metrics && metrics.memory > 900 * 1024 * 1024 ? "alarm" : undefined
          }
        >
          <i
            style={{
              width: `${Math.round(memoryRatio(metrics?.memory ?? 0) * 100)}%`,
            }}
          />
        </span>
        <span className="text-right text-faint">
          {metrics ? formatMemory(metrics.memory) : "—"}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-1">
        {variant === "live" ? (
          ports.length === 0 ? (
            <span className="text-[11.5px] text-faint">—</span>
          ) : (
            ports.map((port) => (
              <span
                key={port}
                className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-[11px] text-mist tabular-nums"
              >
                {port}
              </span>
            ))
          )
        ) : (
          <span
            className={`text-[11.5px] tabular-nums ${
              exit.tone === "bad" ? "text-alarm" : "text-faint"
            }`}
          >
            {active ? t(statusKey(execution.state)) : exit.text}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-0.5">
        {active ? (
          <>
            <IconTool
              icon={ArrowClockwiseIcon}
              size={12}
              label={t("restartCommand")}
              onClick={() => void restartExecution(execution.id)}
            />
            <IconTool
              icon={StopIcon}
              size={12}
              label={t("stopCommand")}
              onClick={stop}
            />
          </>
        ) : (
          <IconTool
            icon={ArrowClockwiseIcon}
            size={12}
            label={t("runAgain")}
            onClick={() => void restartExecution(execution.id)}
          />
        )}
      </div>
    </div>
  );
}

export function ProcessTable({
  executions,
  projects,
  variant,
  title,
  meta,
  empty,
}: {
  executions: Execution[];
  projects: Record<number, string>;
  variant: "live" | "all";
  title: string;
  meta?: string;
  empty: string;
}) {
  const { t } = useI18n();
  const showPort = variant === "live";

  return (
    <Card title={title} meta={meta}>
      {executions.length === 0 ? (
        <CardEmpty note={empty} />
      ) : (
        <>
          <div className="pulso-row pulso-row-proc pulso-row-head border-b border-hairline px-3.5 py-1.5">
            <span>{t("tableProcess")}</span>
            <span>{t("tableInvocation")}</span>
            <span>{t("tableResources")}</span>
            <span>{showPort ? t("tablePort") : t("tableExit")}</span>
            <span />
          </div>
          {executions.map((execution) => (
            <ProcessRow
              key={execution.id}
              execution={execution}
              projectName={
                projects[execution.projectId] ?? `#${execution.projectId}`
              }
              variant={variant}
            />
          ))}
        </>
      )}
    </Card>
  );
}
