import { CaretRightIcon, PlayIcon, StopIcon } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { CommandLogs } from "@/features/executions/CommandLogs";
import {
  commandKey,
  isActiveState,
  latestExecution,
  useElapsed,
} from "@/features/executions/execution";
import { PortBadge } from "@/features/executions/PortBadge";
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
  const openLogKey = useStore((state) => state.openLogKey);
  const startCommand = useStore((state) => state.startCommand);
  const stopExecution = useStore((state) => state.stopExecution);
  const toggleLogs = useStore((state) => state.toggleLogs);
  const openUrl = useStore((state) => state.openUrl);

  const execution = latestExecution(executions, projectId, command.id);
  const active = execution ? isActiveState(execution.state) : false;
  const elapsed = useElapsed(execution?.startedAt, active);
  const invocation = [command.program, ...command.args].join(" ");
  const stopping = execution?.state === "stopping";
  const key = commandKey(projectId, command.id);
  const open = openLogKey === key;

  return (
    <div className="pulso-command-row">
      <div className="pulso-command" data-live={active}>
        <button
          type="button"
          className="pulso-command__open"
          aria-expanded={open}
          onClick={() => toggleLogs(key, execution?.id ?? null)}
        >
          <CaretRightIcon
            size={10}
            className="pulso-command__caret"
            data-quiet={execution === undefined}
          />
          <span
            className="pulso-command__marker"
            data-long-running={command.longRunning}
            title={command.longRunning ? t("longRunningHint") : undefined}
          />
          <span className="pulso-command__label">{command.label}</span>
          <span
            className="pulso-command__value"
            data-active={active}
            title={active ? undefined : invocation}
          >
            {active ? elapsed : invocation}
          </span>
        </button>

        <span className="pulso-command__ports">
          {active
            ? execution?.ports.map((port) => (
                <PortBadge
                  key={port.id}
                  port={port}
                  onOpen={() => {
                    if (execution) void openUrl(execution.id, port.id);
                  }}
                />
              ))
            : null}
        </span>

        {active ? (
          <button
            type="button"
            className="pulso-command__control"
            data-kind="stop"
            aria-label={t("stopCommand")}
            title={t("stopCommand")}
            disabled={stopping}
            onClick={() => {
              if (execution) void stopExecution(execution.id);
            }}
          >
            <StopIcon size={11} weight="fill" />
          </button>
        ) : (
          <button
            type="button"
            className="pulso-command__control"
            aria-label={t("runCommand")}
            title={t("runCommand")}
            disabled={pendingCommandId === command.id}
            onClick={() => void startCommand(projectId, command.id)}
          >
            <PlayIcon size={11} weight="fill" />
          </button>
        )}
      </div>

      {execution?.state === "failed" && execution.detail ? (
        <p
          className="pulso-command__detail line-clamp-2"
          title={execution.detail}
        >
          {execution.detail}
        </p>
      ) : null}

      {execution ? (
        <CommandLogs
          executionId={execution.id}
          open={open}
          active={active}
          label={command.label}
        />
      ) : null}
    </div>
  );
}
