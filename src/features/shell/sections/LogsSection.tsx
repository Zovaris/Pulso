import {
  ArrowDownIcon,
  CopyIcon,
  FloppyDiskIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  StopIcon,
} from "@phosphor-icons/react";
import {
  Button,
  EmptyState,
  IconButton,
  Input,
  SegmentedControl,
} from "@zovaris/sephiro";
import { useEffect, useMemo, useRef } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { Orb } from "@/components/shared/Orb";
import {
  filterLines,
  logText,
  matchCount,
  NO_LINES,
  type StreamFilter,
} from "@/features/desktop/logs";
import {
  formatLogTime,
  isActiveState,
  useElapsed,
} from "@/features/executions/execution";
import type { Execution } from "@/lib/types";

function highlight(text: string, needle: string) {
  const at = text.toLowerCase().indexOf(needle);
  if (at === -1) return text;

  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/**
 * The output of one run. It follows new lines until the reader scrolls up;
 * from then on it holds still and counts what arrived below, so reading
 * never jumps, and one click returns to the live end.
 */
function Stream({
  executionId,
  query,
  stream,
}: {
  executionId: number;
  query: string;
  stream: StreamFilter;
}) {
  const { t } = useI18n();
  const lines = useStore((state) => state.logs[executionId] ?? NO_LINES);
  const live = useStore((state) =>
    state.executions.some(
      (execution) =>
        execution.id === executionId && isActiveState(execution.state),
    ),
  );
  const autoscroll = useStore((state) => state.logAutoscroll);
  const setAutoscroll = useStore((state) => state.setLogAutoscroll);
  const box = useRef<HTMLDivElement>(null);
  const scrolled = useRef(0);
  const pausedAt = useRef<number | null>(null);

  const shown = useMemo(
    () => filterLines(lines, { query, stream }),
    [lines, query, stream],
  );
  const needle = query.trim().toLowerCase();
  const hasOutput = shown.length > 0;
  const latest = shown[shown.length - 1]?.seq ?? 0;

  if (autoscroll) pausedAt.current = null;
  else if (pausedAt.current === null) pausedAt.current = latest;
  const waiting =
    pausedAt.current === null
      ? 0
      : shown.filter((line) => line.seq > (pausedAt.current ?? 0)).length;

  useEffect(() => {
    if (!autoscroll || latest === scrolled.current) return;

    scrolled.current = latest;
    const node = box.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [autoscroll, latest]);

  useEffect(() => {
    const node = box.current;
    if (autoscroll && node) node.scrollTop = node.scrollHeight;
  }, [autoscroll]);

  useEffect(() => {
    const node = box.current;
    if (!hasOutput || !node) return;

    const onScroll = () => {
      const atBottom =
        node.scrollHeight - node.scrollTop - node.clientHeight < 24;
      if (atBottom !== useStore.getState().logAutoscroll)
        setAutoscroll(atBottom);
    };

    node.addEventListener("scroll", onScroll);
    return () => node.removeEventListener("scroll", onScroll);
  }, [setAutoscroll, hasOutput]);

  if (!hasOutput) {
    return (
      <div className="pulso-stream flex flex-1 items-center justify-center">
        {lines.length === 0 && live ? (
          <EmptyState
            compact
            icon={<Orb state="listening" size={64} />}
            title={t("waitingOutput")}
          />
        ) : (
          <EmptyState
            compact
            title={lines.length === 0 ? t("noOutput") : t("noMatch")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={box} className="pulso-stream min-h-0 flex-1 overflow-auto py-2">
        {shown.map((line) => (
          <div
            key={line.seq}
            className="pulso-stream__line"
            data-stream={line.stream}
          >
            <time className="flex-none text-faint tabular-nums">
              {formatLogTime(line.at)}
            </time>
            <span className="min-w-0 break-all">
              {needle === "" ? line.text : highlight(line.text, needle)}
            </span>
          </div>
        ))}
      </div>
      {waiting > 0 ? (
        <Button
          size="sm"
          variant="secondary"
          className="pulso-new-lines"
          onClick={() => setAutoscroll(true)}
        >
          <ArrowDownIcon size={12} />
          {t("newLines", { count: waiting })}
        </Button>
      ) : null}
    </div>
  );
}

function RunItem({
  execution,
  selected,
  projectName,
  onSelect,
}: {
  execution: Execution;
  selected: boolean;
  projectName: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="pulso-run-item"
      aria-current={selected || undefined}
      onClick={onSelect}
    >
      <i className="pulso-dot" data-s={execution.state} />
      <span className="truncate font-medium">{execution.label}</span>
      <span className="min-w-0 flex-1 truncate text-faint">{projectName}</span>
    </button>
  );
}

function RunHeader({
  execution,
  projectName,
}: {
  execution: Execution;
  projectName: string;
}) {
  const { t } = useI18n();
  const active = isActiveState(execution.state);
  const elapsed = useElapsed(execution.startedAt, active);
  const settling =
    execution.state === "starting" || execution.state === "stopping";
  const state = t(
    `state${execution.state[0].toUpperCase()}${execution.state.slice(1)}`,
  );
  return (
    <header className="flex flex-none items-center gap-3 px-4 pt-4 pb-3">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <span className="truncate">{execution.label}</span>
          <span className="truncate font-normal text-faint">{projectName}</span>
        </h1>
        <p className="mt-1 flex min-w-0 items-center gap-2 text-[11.5px] text-faint">
          <span className="pulso-state" data-s={execution.state}>
            <i className="pulso-dot" data-s={execution.state} />
            {active
              ? `${state} · ${elapsed}`
              : execution.state === "failed"
                ? `${state} · ${t("exitCode", { code: String(execution.exitCode ?? "·") })}`
                : state}
          </span>
          <span className="truncate font-mono">
            {[execution.program, ...execution.args].join(" ")}
          </span>
        </p>
      </div>
      <Button
        size="sm"
        variant={active ? "secondary" : "quiet"}
        motion="none"
        className="pulso-run-button"
        disabled={settling}
        onClick={() => {
          const store = useStore.getState();
          if (!active) void store.restartExecution(execution.id);
          else if (store.confirmStop) store.askStop(execution.id);
          else void store.stopExecution(execution.id);
        }}
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
    </header>
  );
}

export function LogsSection() {
  const { t } = useI18n();
  const executions = useStore((state) => state.executions);
  const projects = useStore((state) => state.projects);
  const filter = useStore((state) => state.logFilter);
  const setLogFilter = useStore((state) => state.setLogFilter);
  const selectedId = useStore((state) => state.selectedExecutionId);
  const select = useStore((state) => state.select);
  const loadLogs = useStore((state) => state.loadLogs);
  const saveLog = useStore((state) => state.saveLog);
  const note = useStore((state) => state.note);
  const logLines = useStore((state) => state.logLines);
  const autoscroll = useStore((state) => state.logAutoscroll);
  const setAutoscroll = useStore((state) => state.setLogAutoscroll);

  const ordered = [...executions].sort(
    (left, right) => right.startedAt - left.startedAt,
  );
  const running = ordered.filter((execution) => isActiveState(execution.state));
  const finished = ordered.filter(
    (execution) => !isActiveState(execution.state),
  );
  const selected =
    ordered.find((entry) => entry.id === selectedId) ??
    running[0] ??
    ordered[0];
  const lines = useStore((state) =>
    selected ? (state.logs[selected.id] ?? NO_LINES) : NO_LINES,
  );
  const matches = matchCount(lines, filter.query);
  const shown = filterLines(lines, filter).length;
  const projectName = (id: number) =>
    projects.find((entry) => entry.id === id)?.name ??
    (id === 0 ? t("personalCommands") : `#${id}`);

  const selectedExecutionId = selected?.id;
  useEffect(() => {
    if (selectedExecutionId !== undefined) void loadLogs(selectedExecutionId);
  }, [selectedExecutionId, loadLogs]);

  if (!selected) {
    return (
      <div className="pulso-pane flex flex-1 items-center justify-center">
        <EmptyState compact title={t("noExecutions")} />
      </div>
    );
  }

  const group = (title: string, list: Execution[]) =>
    list.length === 0 ? null : (
      <div>
        <p className="pulso-run-heading">{title}</p>
        {list.map((execution) => (
          <RunItem
            key={execution.id}
            execution={execution}
            selected={execution.id === selected.id}
            projectName={projectName(execution.projectId)}
            onSelect={() => select(execution.id)}
          />
        ))}
      </div>
    );

  return (
    <div className="flex min-w-0 flex-1">
      <nav className="pulso-pane pulso-run-list" aria-label={t("sectionLogs")}>
        {group(t("runsActive"), running)}
        {group(t("runsFinished"), finished)}
      </nav>

      <section className="flex min-w-0 flex-1 flex-col">
        <RunHeader
          execution={selected}
          projectName={projectName(selected.projectId)}
        />

        <div className="pulso-filter-bar px-4!">
          <label className="pulso-search pulso-search--wide">
            <MagnifyingGlassIcon size={13} aria-hidden />
            <Input
              size="sm"
              value={filter.query}
              onChange={(event) =>
                setLogFilter({ ...filter, query: event.target.value })
              }
              placeholder={t("searchLogs")}
              aria-label={t("searchLogs")}
            />
          </label>
          {filter.query.trim() === "" ? null : (
            <span className="flex-none text-[11.5px] text-faint tabular-nums">
              {t("matchCount", { count: matches })}
            </span>
          )}
          <SegmentedControl
            size="sm"
            ariaLabel={t("filterStreams")}
            value={filter.stream}
            onValueChange={(stream) =>
              setLogFilter({ ...filter, stream: stream as StreamFilter })
            }
            options={(["all", "stdout", "stderr"] as StreamFilter[]).map(
              (stream) => ({
                value: stream,
                label: stream === "all" ? t("filterAll") : stream,
              }),
            )}
          />
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant={autoscroll ? "secondary" : "quiet"}
              motion="none"
              aria-pressed={autoscroll}
              onClick={() => setAutoscroll(!autoscroll)}
            >
              <ArrowDownIcon size={12} />
              {t("followOutput")}
            </Button>
            <IconButton
              size="sm"
              variant="ghost"
              icon={<CopyIcon size={15} />}
              label={t("copyLog")}
              title={t("copyLog")}
              onClick={() => {
                void navigator.clipboard
                  .writeText(logText(filterLines(lines, filter)))
                  .then(() => note(t("copied")));
              }}
            />
            <IconButton
              size="sm"
              variant="ghost"
              icon={<FloppyDiskIcon size={15} />}
              label={t("saveLog")}
              title={t("saveLog")}
              onClick={() => void saveLog(selected.id, selected.label)}
            />
          </div>
        </div>

        <Stream
          key={selected.id}
          executionId={selected.id}
          query={filter.query}
          stream={filter.stream}
        />

        <footer className="pulso-section-footer flex justify-between gap-4">
          <span>{t("lineCount", { count: shown })}</span>
          <span>{t("logRetention", { count: logLines })}</span>
        </footer>
      </section>
    </div>
  );
}
