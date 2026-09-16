import { Play, Stop } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import {
  isActiveState,
  latestExecution,
  useElapsed,
} from "@/features/executions/execution";
import type { DetectedCommand } from "@/lib/types";

export function CommandRow({
  projectId,
  command,
}: {
  projectId: number;
  command: DetectedCommand;
}) {
  const { t } = useI18n();
  const executions = useStore((state) => state.executions);
  const pendingCommandId = useStore((state) => state.pendingCommandId);
  const startCommand = useStore((state) => state.startCommand);
  const stopExecution = useStore((state) => state.stopExecution);

  const execution = latestExecution(executions, projectId, command.id);
  const active = execution ? isActiveState(execution.state) : false;
  const elapsed = useElapsed(execution?.startedAt, active);
  const invocation = [command.program, ...command.args].join(" ");
  const stopping = execution?.state === "stopping";

  return (
    <div className="soffy-command-row">
      <div className="soffy-command">
        <span
          className="soffy-command__marker"
          data-running={command.longRunning}
          title={command.longRunning ? t("longRunningHint") : undefined}
        />
        <span className="soffy-command__label">{command.label}</span>
        <span
          className="soffy-command__value"
          data-active={active}
          title={active ? undefined : invocation}
        >
          {active ? elapsed : invocation}
        </span>

        {active ? (
          <button
            type="button"
            className="soffy-command__control"
            data-kind="stop"
            aria-label={t("stopCommand")}
            title={t("stopCommand")}
            disabled={stopping}
            onClick={() => {
              if (execution) void stopExecution(execution.id);
            }}
          >
            <Stop size={11} weight="fill" />
          </button>
        ) : (
          <button
            type="button"
            className="soffy-command__control"
            aria-label={t("runCommand")}
            title={t("runCommand")}
            disabled={pendingCommandId === command.id}
            onClick={() => void startCommand(projectId, command.id)}
          >
            <Play size={11} weight="fill" />
          </button>
        )}
      </div>

      {execution?.state === "failed" && execution.detail ? (
        <p className="soffy-command__detail">{execution.detail}</p>
      ) : null}
    </div>
  );
}
