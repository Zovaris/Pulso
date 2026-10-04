import {
  ArrowClockwiseIcon,
  FolderSimplePlusIcon,
  TextAlignLeftIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button, EmptyState } from "@zovaris/sephiro";
import { useMemo } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import {
  type CatalogRow,
  catalogKey,
  catalogRows,
} from "@/features/desktop/catalog";
import {
  formatCpu,
  formatMemory,
  totalCpu,
  totalMemory,
} from "@/features/desktop/metrics";
import { byUptime, openPorts } from "@/features/desktop/session";
import { isActiveState } from "@/features/executions/execution";
import { activity } from "@/features/popover/menubar/MenubarMenu";
import { useAddProject } from "@/features/projects/useAddProject";
import { useCommandEditor } from "@/features/shell/components/CommandEditor";
import { CommandTable } from "@/features/shell/components/CommandTable";
import { ExecutionTable } from "@/features/shell/components/ExecutionTable";
import { ProcessInspector } from "@/features/shell/components/Inspector";
import type { Execution } from "@/lib/types";

const RECENT = 5;

/**
 * Starred commands first, then the latest distinct runs that are not starred.
 * What already runs is listed above it, so it is left out here.
 */
export function launchRows(
  rows: CatalogRow[],
  executions: Execution[],
): CatalogRow[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const running = new Set(
    executions
      .filter((execution) => isActiveState(execution.state))
      .map((execution) => catalogKey(execution.projectId, execution.commandId)),
  );
  const favorites = rows.filter(
    (row) => row.favorite && !row.hidden && !running.has(row.key),
  );
  const taken = new Set([...favorites.map((row) => row.key), ...running]);
  const recent: CatalogRow[] = [];
  for (const execution of [...executions].sort(
    (left, right) => right.startedAt - left.startedAt,
  )) {
    const row = byKey.get(catalogKey(execution.projectId, execution.commandId));
    if (!row || taken.has(row.key)) continue;
    taken.add(row.key);
    recent.push(row);
    if (recent.length === RECENT) break;
  }
  return [...favorites, ...recent];
}

/** Real numbers only, on one line: what runs, what it costs, what it listens on. */
function Stats({ live }: { live: Execution[] }) {
  const { t } = useI18n();
  const metrics = useStore((state) => state.metrics);
  const samples = live
    .map((execution) => metrics[execution.id])
    .filter((sample) => sample !== undefined);
  const ports = openPorts(live);
  return (
    <p className="pulso-stats">
      <span>
        <i className="pulso-dot" data-s={live.length ? "running" : "exited"} />
        {live.length
          ? t("statRunning", { count: live.length })
          : t("noneRunning")}
      </span>
      {live.length ? <span>{formatCpu(totalCpu(samples))} CPU</span> : null}
      {live.length ? <span>{formatMemory(totalMemory(samples))}</span> : null}
      {ports.length ? (
        <span>
          {t("statPorts", { count: ports.length })}{" "}
          <span className="font-mono text-faint">
            {ports.map((port) => `:${port}`).join(" ")}
          </span>
        </span>
      ) : null}
    </p>
  );
}

function Attention({ failed }: { failed: Execution[] }) {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const markFailuresSeen = useStore((state) => state.markFailuresSeen);
  const restartExecution = useStore((state) => state.restartExecution);
  const projectName = (id: number) =>
    projects.find((project) => project.id === id)?.name ??
    t("personalCommands");
  return (
    <section className="pulso-attention" aria-labelledby="attention-title">
      <header className="flex items-center gap-2 py-1 pr-2 pl-3">
        <WarningCircleIcon
          size={14}
          weight="fill"
          className="flex-none text-alarm"
        />
        <h2 id="attention-title" className="flex-1 text-[12px] font-medium">
          {t("attentionTitle")}
        </h2>
        <Button
          size="sm"
          variant="quiet"
          motion="none"
          onClick={markFailuresSeen}
        >
          {t("dismissFailures")}
        </Button>
      </header>
      <ul>
        {failed.map((execution) => (
          <li key={execution.id} className="pulso-attention__row">
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{execution.label}</span>{" "}
              <span className="text-faint">
                {projectName(execution.projectId)}
              </span>
            </span>
            <span className="flex-none text-[12px] text-alarm">
              {t("failedWith", { code: String(execution.exitCode ?? "·") })}
            </span>
            <Button
              size="sm"
              variant="quiet"
              motion="none"
              onClick={() => {
                const state = useStore.getState();
                state.select(execution.id);
                state.setSection("logs");
              }}
            >
              <TextAlignLeftIcon size={13} />
              {t("seeLogs")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              motion="none"
              onClick={() => void restartExecution(execution.id)}
            >
              <ArrowClockwiseIcon size={13} />
              {t("runAgain")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OverviewSection() {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const customs = useStore((state) => state.customCommands);
  const executions = useStore((state) => state.executions);
  const seenAt = useStore((state) => state.seenFailuresAt);
  const addProject = useAddProject();
  const editor = useCommandEditor();

  const live = byUptime(executions);
  const failed = activity(executions, seenAt).filter(
    (execution) => !isActiveState(execution.state),
  );
  const rows = useMemo(
    () => catalogRows(projects, scans, customs, t("personalCommands")),
    [projects, scans, customs, t],
  );
  const launch = launchRows(rows, executions);

  if (projects.length === 0 && customs.length === 0) {
    return (
      <div className="pulso-pane flex min-w-0 flex-1 items-center justify-center p-6">
        <EmptyState
          icon={<FolderSimplePlusIcon size={28} />}
          title={t("welcomeTitle")}
          description={t("welcomeBody")}
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => void addProject()}
            >
              {t("addProject")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="pulso-pane flex min-w-0 flex-1 flex-col gap-5 overflow-auto px-6 py-5">
        <header>
          <h1 className="text-[16px] font-semibold tracking-[-0.015em]">
            {t("sectionOverview")}
          </h1>
          <p className="mt-1 text-[12px] text-mist">{t("overviewLede")}</p>
          <Stats live={live} />
        </header>

        {failed.length ? <Attention failed={failed} /> : null}

        <section>
          <h2 className="pulso-block-title">{t("liveProcesses")}</h2>
          <ExecutionTable
            executions={live}
            label={t("liveProcesses")}
            empty={<EmptyState compact title={t("noLiveProcesses")} />}
          />
        </section>

        <section>
          <h2 className="pulso-block-title">{t("launchTitle")}</h2>
          <CommandTable
            rows={launch}
            showProject
            onEdit={editor.edit}
            onRemove={editor.remove}
            empty={<EmptyState compact title={t("launchEmpty")} />}
          />
        </section>
        {editor.dialogs}
      </div>

      <ProcessInspector />
    </>
  );
}
