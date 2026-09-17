import { ArrowSquareOutIcon, FolderOpenIcon } from "@phosphor-icons/react";
import { useEffect } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { sourcesOf } from "@/features/desktop/commands";
import {
  type RunBadge,
  runBadge,
  runDuration,
  runStamp,
  timeline,
} from "@/features/desktop/history";
import { formatCpu, formatMemory } from "@/features/desktop/metrics";
import { exitBadge } from "@/features/desktop/session";
import {
  formatDuration,
  formatLogTime,
  useElapsed,
} from "@/features/executions/execution";
import { scanMessage } from "@/features/projects/scanMessage";
import { AppIcon } from "@/features/shell/components/AppIcon";
import type { Project } from "@/lib/types";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-[10.5px] font-medium tracking-[0.03em] text-faint uppercase">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function Kv({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
      <dt className="text-faint">{name}</dt>
      <dd className="min-w-0 truncate text-right tabular-nums">{value}</dd>
    </div>
  );
}

function InspectorShell({ children }: { children: React.ReactNode }) {
  return (
    <aside className="pulso-inspector pulso-pane w-[316px] flex-none flex-col gap-4 overflow-auto border-l border-line bg-night px-4 py-4">
      {children}
    </aside>
  );
}

function EditorList({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const editors = useStore((state) => state.editors);
  const defaultEditor = useStore((state) => state.editor);
  const openProjectIn = useStore((state) => state.openProjectIn);

  return (
    <Section title={t("openIn")}>
      {editors.map((editor) => (
        <button
          key={editor.id}
          type="button"
          onClick={() => void openProjectIn(projectId, editor.id)}
          className="flex h-[27px] items-center gap-2 rounded-[7px] px-1.5 text-left text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
        >
          <AppIcon id={editor.id} name={editor.name} />
          <span className="truncate">{editor.name}</span>
          {editor.id === defaultEditor ||
          (!defaultEditor && editor === editors[0]) ? (
            <span className="ml-auto text-[10.5px] text-faint">
              {t("defaultEditor")}
            </span>
          ) : null}
        </button>
      ))}
      <button
        type="button"
        onClick={() => void openProjectIn(projectId, "finder")}
        className="flex h-[27px] items-center gap-2 rounded-[7px] px-1.5 text-left text-[12px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
      >
        <AppIcon id="finder" name="Finder" />
        {t("revealInFinder")}
      </button>
      <p className="mt-1 text-[11px] leading-5 text-faint">
        {t("onlyInstalled")}
      </p>
    </Section>
  );
}

export function ProcessInspector() {
  const { t } = useI18n();
  const selectedId = useStore((state) => state.selectedExecutionId);
  const execution = useStore((state) =>
    state.executions.find((entry) => entry.id === selectedId),
  );
  const project = useStore((state) =>
    state.projects.find((entry) => entry.id === execution?.projectId),
  );
  const metrics = useStore((state) =>
    execution ? state.metrics[execution.id] : undefined,
  );
  const lines = useStore((state) =>
    execution ? (state.logs[execution.id] ?? []) : [],
  );
  const openLogs = useStore((state) => state.setSection);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const running =
    execution?.state === "running" ||
    execution?.state === "starting" ||
    execution?.state === "stopping";
  const elapsed = useElapsed(execution?.startedAt, Boolean(running));

  if (!execution) {
    return (
      <InspectorShell>
        <p className="text-[12px] leading-5 text-faint">
          {t("nothingSelected")}
        </p>
      </InspectorShell>
    );
  }

  const exit = exitBadge(execution);
  const tail = lines.slice(-4);
  const projectId = selectedProjectId ?? execution.projectId;

  return (
    <InspectorShell>
      <div>
        <h3 className="truncate text-[12.5px] font-medium">
          {project?.name ?? `#${execution.projectId}`} · {execution.label}
        </h3>
        <p className="mt-0.5 text-[11.5px] text-faint">
          {running
            ? t("runningFor", { value: elapsed })
            : t("finishedWith", { value: exit.text })}
        </p>
      </div>

      <Section title={t("process")}>
        <dl className="flex flex-col gap-1">
          <Kv name={t("pid")} value={execution.pid ?? "—"} />
          <Kv
            name={t("state")}
            value={
              <span className={exit.tone === "bad" ? "text-alarm" : undefined}>
                {t(
                  `state${execution.state[0].toUpperCase()}${execution.state.slice(1)}`,
                )}
              </span>
            }
          />
          <Kv name={t("cpu")} value={metrics ? formatCpu(metrics.cpu) : "—"} />
          <Kv
            name={t("memory")}
            value={metrics ? formatMemory(metrics.memory) : "—"}
          />
          <Kv name={t("children")} value={metrics ? metrics.processes : "—"} />
          <Kv
            name={t("uptime")}
            value={
              running
                ? elapsed
                : formatDuration((execution.endedAt ?? 0) - execution.startedAt)
            }
          />
          <Kv
            name={t("port")}
            value={
              execution.ports.length === 0
                ? "—"
                : execution.ports.map((port) => port.port).join(", ")
            }
          />
        </dl>
      </Section>

      <Section title={t("invocation")}>
        <p className="font-mono text-[11.5px] break-all text-mist">
          {[execution.program, ...execution.args].join(" ")}
        </p>
        <p className="mt-1 font-mono text-[11px] break-all text-faint">
          {execution.cwd}
        </p>
      </Section>

      <Section title={t("lastLines")}>
        {tail.length === 0 ? (
          <p className="text-[11.5px] text-faint">{t("waitingOutput")}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {tail.map((line) => (
              <p
                key={line.seq}
                className="pulso-stream__line flex gap-2 text-[11px] leading-5"
                data-stream={line.stream}
              >
                <time className="flex-none text-faint tabular-nums">
                  {formatLogTime(line.at)}
                </time>
                <span className="min-w-0 truncate">{line.text}</span>
              </p>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => openLogs("logs")}
          className="mt-2 flex h-[26px] w-full items-center justify-center gap-1.5 rounded-[7px] border border-line text-[11.5px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
        >
          <ArrowSquareOutIcon size={12} />
          {t("openFullLog")}
        </button>
      </Section>

      <EditorList projectId={projectId} />
    </InspectorShell>
  );
}

function badgeClass(tone: RunBadge["tone"]): string {
  const shared = "w-[18px] flex-none text-right tabular-nums";

  if (tone === "bad") return `${shared} text-alarm`;
  if (tone === "ok") return `${shared} text-ok`;

  return `${shared} text-faint`;
}

function ProjectTimeline({ projectId }: { projectId: number }) {
  const { t, locale } = useI18n();
  const executions = useStore((state) => state.executions);
  const history = useStore((state) => state.history);
  const historyProject = useStore((state) => state.historyProject);
  const historyLog = useStore((state) => state.historyLog);
  const loadHistory = useStore((state) => state.loadHistory);
  const toggleHistoryLog = useStore((state) => state.toggleHistoryLog);

  useEffect(() => {
    void loadHistory(projectId);
  }, [loadHistory, projectId]);

  const runs = timeline(
    executions,
    historyProject === projectId ? history : [],
    projectId,
  );

  if (runs.length === 0) {
    return <p className="text-[11.5px] text-faint">{t("nothingRan")}</p>;
  }

  const now = Date.now();

  return (
    <div className="flex flex-col">
      {runs.map((run) => {
        const badge = runBadge(run);
        const stored = run.source === "history" && run.lines > 0;

        return (
          <div key={run.key}>
            <button
              type="button"
              disabled={!stored}
              title={stored ? t("openStoredLog") : (run.detail ?? undefined)}
              onClick={() => void toggleHistoryLog(run.id)}
              className={`flex w-full items-center gap-2 rounded-[7px] px-1.5 py-1 text-left transition-colors duration-[120ms] ${
                stored ? "cursor-pointer hover:bg-hover" : "cursor-default"
              }`}
            >
              <i className="pulso-dot" data-s={run.state} />
              <span className="min-w-0 flex-1 truncate text-[11.5px]">
                {run.label}
              </span>
              <span className="flex-none text-[10.5px] text-faint tabular-nums">
                {runStamp(run.startedAt, now, locale)}
              </span>
              <span className="w-[38px] flex-none text-right text-[10.5px] text-faint tabular-nums">
                {runDuration(run, now)}
              </span>
              <span className={badgeClass(badge.tone)}>{badge.text}</span>
            </button>

            {historyLog?.id === run.id ? (
              <div className="pulso-stream mb-1.5 max-h-[176px] overflow-auto rounded-[7px] border border-hairline py-1">
                {historyLog.lines.map((line) => (
                  <p
                    key={line.seq}
                    className="pulso-stream__line flex gap-2 px-2 py-[1px] font-mono text-[10.5px] leading-4"
                    data-stream={line.stream}
                  >
                    <time className="flex-none text-faint tabular-nums">
                      {formatLogTime(line.at)}
                    </time>
                    <span className="min-w-0 break-all">{line.text}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ProjectInspector({ project }: { project: Project }) {
  const { t } = useI18n();
  const scan = useStore((state) => state.scans[String(project.id)]);
  const scanning = useStore((state) => state.scanningProjectId === project.id);
  const environment = useStore((state) =>
    state.environmentFor === project.id ? state.environment : null,
  );
  const message = scan ? scanMessage(scan) : null;
  const sources = scan ? sourcesOf(scan) : [];
  const missing =
    environment?.programs.filter((program) => program.path === null) ?? [];

  return (
    <InspectorShell>
      <div>
        <h3 className="truncate text-[12.5px] font-medium">{project.name}</h3>
        <p
          className="mt-0.5 truncate font-mono text-[11px] text-faint"
          title={project.path}
        >
          {project.path}
        </p>
      </div>

      <Section title={t("filesRead")}>
        {sources.length === 0 ? (
          <p className="text-[11.5px] text-faint">
            {scanning ? t("readingManifest") : t("noFilesRead")}
          </p>
        ) : (
          <dl className="flex flex-col gap-1">
            {sources.map((source) => (
              <Kv key={source.label} name={source.label} value={source.count} />
            ))}
          </dl>
        )}
      </Section>

      <Section title={t("scan")}>
        <dl className="flex flex-col gap-1">
          <Kv
            name={t("state")}
            value={
              message ? t(message.key) : scanning ? t("readingManifest") : "—"
            }
          />
          <Kv
            name={t("folderState")}
            value={
              project.availability === "available"
                ? t("available")
                : t("missing")
            }
          />
        </dl>
        {message ? (
          <p className="mt-1 text-[11px] leading-5 text-faint">
            {t(message.key)}
          </p>
        ) : null}
      </Section>

      <Section title={t("whatPopoverSees")}>
        <p className="text-[11px] leading-5 text-faint">{t("popoverRule")}</p>
      </Section>

      <Section title={t("lastRuns")}>
        <ProjectTimeline projectId={project.id} />
      </Section>

      <Section title={t("environment")}>
        {environment === null ? (
          <button
            type="button"
            onClick={() => void useStore.getState().loadEnvironment(project.id)}
            className="flex h-[26px] items-center justify-center gap-1.5 rounded-[7px] border border-line text-[11.5px] text-mist transition-colors duration-[120ms] hover:bg-hover hover:text-paper"
          >
            <FolderOpenIcon size={12} />
            {t("checkEnvironment")}
          </button>
        ) : (
          <>
            <dl className="flex flex-col gap-1">
              {environment.programs.map((program) => (
                <Kv
                  key={program.name}
                  name={program.name}
                  value={
                    <span
                      className={
                        program.path === null ? "text-alarm" : undefined
                      }
                    >
                      {program.path === null ? t("notFound") : program.path}
                    </span>
                  }
                />
              ))}
            </dl>
            <p className="mt-1 font-mono text-[10.5px] break-all text-faint">
              {environment.shell}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-faint">
              {missing.length === 0
                ? t("environmentFine")
                : t("environmentMissing", { count: missing.length })}
            </p>
          </>
        )}
      </Section>

      <EditorList projectId={project.id} />
    </InspectorShell>
  );
}
