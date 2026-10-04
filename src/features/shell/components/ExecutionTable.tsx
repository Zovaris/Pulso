import {
  ArrowClockwiseIcon,
  DotsThreeIcon,
  PlayIcon,
  StopIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react";
import {
  Button,
  IconButton,
  Menu,
  type MenuItem,
  type Renderable,
  Table,
  type TableColumn,
} from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { Orb } from "@/components/shared/Orb";
import { formatCpu, formatMemory } from "@/features/desktop/metrics";
import {
  formatDuration,
  isActiveState,
  useElapsed,
} from "@/features/executions/execution";
import type { Execution } from "@/lib/types";

function stateLabel(
  execution: Execution,
  t: ReturnType<typeof useI18n>["t"],
): string {
  const word = t(
    `state${execution.state[0].toUpperCase()}${execution.state.slice(1)}`,
  );
  if (execution.state === "failed" && execution.exitCode !== null)
    return `${word} · ${t("exitCode", { code: String(execution.exitCode) })}`;
  return word;
}

function openLogs(execution: Execution) {
  const state = useStore.getState();
  state.select(execution.id);
  state.setSection("logs");
}

function stop(execution: Execution) {
  const state = useStore.getState();
  if (state.confirmStop) state.askStop(execution.id);
  else void state.stopExecution(execution.id);
}

function State({ execution }: { execution: Execution }) {
  const { t } = useI18n();
  return (
    <span className="pulso-state" data-s={execution.state}>
      {execution.state === "starting" || execution.state === "stopping" ? (
        <Orb state="working" />
      ) : (
        <i className="pulso-dot" data-s={execution.state} />
      )}
      <span className="truncate">{stateLabel(execution, t)}</span>
    </span>
  );
}

function Name({
  execution,
  projectName,
}: {
  execution: Execution;
  projectName: string;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="pulso-cell-link"
      title={t("seeLogs")}
      onClick={() => openLogs(execution)}
    >
      <span className="truncate font-medium">{execution.label}</span>
      <span className="truncate text-faint">{projectName}</span>
    </button>
  );
}

function Duration({ execution }: { execution: Execution }) {
  const active = isActiveState(execution.state);
  const elapsed = useElapsed(execution.startedAt, active);
  return (
    <span className="tabular-nums">
      {active
        ? elapsed
        : formatDuration(
            (execution.endedAt ?? execution.startedAt) - execution.startedAt,
          )}
    </span>
  );
}

function Usage({
  execution,
  field,
}: {
  execution: Execution;
  field: "cpu" | "memory";
}) {
  const sample = useStore((state) => state.metrics[execution.id]);
  if (!sample || !isActiveState(execution.state))
    return <span className="text-faint">—</span>;
  return (
    <span className="tabular-nums">
      {field === "cpu" ? formatCpu(sample.cpu) : formatMemory(sample.memory)}
    </span>
  );
}

/** A server gets this long to open its first port before the wait stops showing. */
const PORT_WAIT_MS = 60_000;

function Ports({ execution }: { execution: Execution }) {
  const { t } = useI18n();
  const openUrl = useStore((state) => state.openUrl);
  const server = useStore(
    (state) =>
      state.scans[String(execution.projectId)]?.commands.find(
        (command) => command.id === execution.commandId,
      )?.longRunning ?? false,
  );
  if (
    server &&
    execution.state === "running" &&
    execution.ports.length === 0 &&
    Date.now() - execution.startedAt < PORT_WAIT_MS
  )
    return (
      <span
        className="flex min-w-0 items-center gap-1.5 text-faint"
        title={t("waitingPort")}
      >
        <Orb state="connecting" />
        <span className="truncate">{t("waitingPort")}</span>
      </span>
    );
  if (execution.ports.length === 0 || !isActiveState(execution.state))
    return <span className="text-faint">—</span>;
  return (
    <span className="flex min-w-0 gap-1">
      {execution.ports.map((port) => (
        <button
          key={port.id}
          type="button"
          className="pulso-port-chip"
          title={port.url ?? undefined}
          onClick={() => void openUrl(execution.id, port.id)}
        >
          :{port.port}
        </button>
      ))}
    </span>
  );
}

function Actions({ execution }: { execution: Execution }) {
  const { t } = useI18n();
  const restartExecution = useStore((state) => state.restartExecution);
  const active = isActiveState(execution.state);
  const settling =
    execution.state === "starting" || execution.state === "stopping";
  const items: MenuItem[] = [
    {
      value: "logs",
      label: t("seeLogs"),
      icon: <TextAlignLeftIcon size={15} />,
    },
    ...(active
      ? [
          {
            value: "restart",
            label: t("restartCommand"),
            icon: <ArrowClockwiseIcon size={15} />,
            disabled: settling,
          },
        ]
      : []),
  ];
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant={active ? "secondary" : "quiet"}
        motion="none"
        className="pulso-run-button"
        disabled={settling}
        onClick={() =>
          active ? stop(execution) : void restartExecution(execution.id)
        }
      >
        {active ? (
          <StopIcon size={11} weight="fill" />
        ) : (
          <PlayIcon size={11} weight="fill" />
        )}
        {t(
          execution.state === "stopping"
            ? "stateStopping"
            : active
              ? "stopCommand"
              : "runAgain",
        )}
      </Button>
      <Menu
        label={`${t("moreActions")} · ${execution.label}`}
        align="end"
        trigger={
          <IconButton
            size="sm"
            variant="ghost"
            icon={<DotsThreeIcon size={16} weight="bold" />}
            label={`${t("moreActions")} · ${execution.label}`}
            title={t("moreActions")}
          />
        }
        items={items}
        onSelect={(value) => {
          if (value === "logs") openLogs(execution);
          else if (value === "restart") void restartExecution(execution.id);
        }}
      />
    </div>
  );
}

/**
 * Runs of commands, one line each: state, what and where, how long, what it
 * costs, the ports it opened, and Stop or Run again at a fixed width.
 */
export function ExecutionTable({
  executions,
  empty,
  label,
}: {
  executions: Execution[];
  empty: Renderable;
  label: string;
}) {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const projectName = (id: number) =>
    projects.find((project) => project.id === id)?.name ??
    (id === 0 ? t("personalCommands") : `#${id}`);
  const columns: TableColumn<Execution>[] = [
    {
      key: "state",
      label: t("columnState"),
      width: "128px",
      render: (execution) => <State execution={execution} />,
    },
    {
      key: "name",
      label: t("columnName"),
      width: "22%",
      sortable: true,
      sortValue: (execution) => execution.label.toLowerCase(),
      render: (execution) => (
        <Name
          execution={execution}
          projectName={projectName(execution.projectId)}
        />
      ),
    },
    {
      key: "invocation",
      label: t("columnCommand"),
      render: (execution) => (
        <span
          className="block truncate font-mono text-xs text-faint"
          title={[execution.program, ...execution.args].join(" ")}
        >
          {[execution.program, ...execution.args].join(" ")}
        </span>
      ),
    },
    {
      key: "duration",
      label: t("columnDuration"),
      width: "72px",
      align: "end",
      sortable: true,
      sortValue: (execution) =>
        (execution.endedAt ?? Date.now()) - execution.startedAt,
      render: (execution) => <Duration execution={execution} />,
    },
    {
      key: "cpu",
      label: t("columnCpu"),
      width: "60px",
      align: "end",
      render: (execution) => <Usage execution={execution} field="cpu" />,
    },
    {
      key: "memory",
      label: t("columnMemory"),
      width: "80px",
      align: "end",
      render: (execution) => <Usage execution={execution} field="memory" />,
    },
    {
      key: "ports",
      label: t("columnPorts"),
      width: "96px",
      render: (execution) => <Ports execution={execution} />,
    },
    {
      key: "actions",
      label: <span className="sr-only">{t("moreActions")}</span>,
      align: "end",
      width: "164px",
      render: (execution) => <Actions execution={execution} />,
    },
  ];
  return (
    <Table
      columns={columns}
      rows={executions}
      rowKey="id"
      density="compact"
      stickyHeader
      emptyMessage={empty}
      aria-label={label}
      className="pulso-command-table pulso-execution-table"
    />
  );
}
