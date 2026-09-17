import {
  ArrowDownIcon,
  CopyIcon,
  FloppyDiskIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { IconTool } from "@/components/shared/IconTool";
import {
  filterLines,
  logText,
  matchCount,
  NO_LINES,
  type StreamFilter,
} from "@/features/desktop/logs";
import { formatLogTime } from "@/features/executions/execution";
import { scanMessage } from "@/features/projects/scanMessage";
import type { Execution } from "@/lib/types";

function stateOf(execution: Execution): string {
  if (execution.state === "running" || execution.state === "starting")
    return "running";
  if (execution.state === "stopping") return "stopping";

  return execution.state === "failed" ? "failed" : "exited";
}

function Stream({
  executionId,
  query,
}: {
  executionId: number;
  query: string;
}) {
  const { t } = useI18n();
  const lines = useStore((state) => state.logs[executionId] ?? NO_LINES);
  const autoscroll = useStore((state) => state.logAutoscroll);
  const setAutoscroll = useStore((state) => state.setLogAutoscroll);
  const box = useRef<HTMLDivElement>(null);
  const scrolled = useRef(0);

  const shown = filterLines(lines, { query, stream: "all" });
  const needle = query.trim().toLowerCase();

  useEffect(() => {
    if (!autoscroll || shown.length === scrolled.current) return;

    scrolled.current = shown.length;
    const node = box.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [autoscroll, shown]);

  useEffect(() => {
    const node = box.current;
    if (!node) return;

    const onScroll = () => {
      const atBottom =
        node.scrollHeight - node.scrollTop - node.clientHeight < 24;
      if (atBottom !== autoscroll) setAutoscroll(atBottom);
    };

    node.addEventListener("scroll", onScroll);
    return () => node.removeEventListener("scroll", onScroll);
  }, [autoscroll, setAutoscroll]);

  if (shown.length === 0) {
    return (
      <p className="pulso-stream flex-1 px-3.5 py-6 text-center text-[12px] text-faint">
        {lines.length === 0 ? t("noOutput") : t("noMatch")}
      </p>
    );
  }

  return (
    <div ref={box} className="pulso-stream flex-1 overflow-auto py-1.5">
      {shown.map((line) => (
        <div
          key={line.seq}
          className="pulso-stream__line flex gap-2.5 px-3.5 py-[1px] font-mono text-[11.5px] leading-5"
          data-stream={line.stream}
        >
          <time className="flex-none text-faint tabular-nums">
            {formatLogTime(line.at)}
          </time>
          <span className="flex-none text-faint">
            {line.stream === "stderr" ? "!" : "▸"}
          </span>
          <span className="min-w-0 break-all">
            {needle === "" ? line.text : highlight(line.text, needle)}
          </span>
        </div>
      ))}
    </div>
  );
}

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

export function LogsSection() {
  const { t } = useI18n();
  const executions = useStore((state) => state.executions);
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const logs = useStore((state) => state.logs);
  const filter = useStore((state) => state.logFilter);
  const setLogFilter = useStore((state) => state.setLogFilter);
  const selectedId = useStore((state) => state.selectedExecutionId);
  const select = useStore((state) => state.select);
  const loadLogs = useStore((state) => state.loadLogs);
  const saveLog = useStore((state) => state.saveLog);
  const note = useStore((state) => state.note);

  const ordered = [...executions].sort(
    (left, right) => right.startedAt - left.startedAt,
  );
  const selected =
    ordered.find((entry) => entry.id === selectedId) ?? ordered[0];
  const lines = selected ? (logs[selected.id] ?? []) : [];
  const matches = matchCount(lines, filter.query);
  const shown = filterLines(lines, filter).length;

  useEffect(() => {
    if (selected && logs[selected.id] === undefined) void loadLogs(selected.id);
  }, [selected, logs, loadLogs]);

  if (!selected) {
    return (
      <div className="pulso-pane flex flex-1 items-center justify-center">
        <p className="text-[12.5px] text-faint">{t("noExecutions")}</p>
      </div>
    );
  }

  const project = projects.find((entry) => entry.id === selected.projectId);
  const scan = scans[String(selected.projectId)];
  const message = scan ? scanMessage(scan) : null;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="pulso-pane flex w-[228px] flex-none flex-col gap-0.5 overflow-auto border-r border-line bg-night py-3">
        {ordered.map((execution) => (
          <button
            key={execution.id}
            type="button"
            onClick={() => select(execution.id)}
            className={`flex items-center gap-2 px-3 py-1.5 text-left transition-colors duration-[120ms] ${
              execution.id === selected.id ? "bg-fill" : "hover:bg-hover"
            }`}
          >
            <i className="pulso-dot" data-s={stateOf(execution)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px]">
                {projects.find((entry) => entry.id === execution.projectId)
                  ?.name ?? `#${execution.projectId}`}{" "}
                · {execution.label}
              </span>
            </span>
            <span className="text-[11px] text-faint tabular-nums">
              {logs[execution.id]?.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-none items-center gap-2 border-b border-line px-3.5 py-2">
          <label className="flex h-[26px] min-w-[220px] flex-1 items-center gap-2 rounded-[7px] border border-line px-2 focus-within:border-accent">
            <MagnifyingGlassIcon size={12} className="flex-none text-faint" />
            <input
              value={filter.query}
              onChange={(event) =>
                setLogFilter({ ...filter, query: event.target.value })
              }
              placeholder={t("searchLogs")}
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
            />
            {filter.query.trim() === "" ? null : (
              <span className="flex-none text-[11px] text-faint tabular-nums">
                {t("matchCount", { count: matches })}
              </span>
            )}
          </label>

          {(["all", "stdout", "stderr"] as StreamFilter[]).map((stream) => (
            <button
              key={stream}
              type="button"
              onClick={() => setLogFilter({ ...filter, stream })}
              className={`h-[26px] rounded-[7px] border px-2.5 font-mono text-[11px] transition-colors duration-[120ms] ${
                filter.stream === stream
                  ? "border-transparent bg-accent text-white"
                  : "border-line text-mist hover:bg-hover hover:text-paper"
              }`}
            >
              {stream === "all" ? t("filterAll") : stream}
            </button>
          ))}

          <span className="ml-auto flex-none text-[11px] text-faint tabular-nums">
            {t("lineCount", { count: shown })}
          </span>
          <IconTool
            icon={CopyIcon}
            label={t("copyLog")}
            onClick={() => {
              void navigator.clipboard
                .writeText(logText(filterLines(lines, filter)))
                .then(() => note(t("copied")));
            }}
          />
          <IconTool
            icon={FloppyDiskIcon}
            label={t("saveLog")}
            onClick={() => void saveLog(selected.id, selected.label)}
          />
        </div>

        <div className="flex flex-none items-center gap-2 border-b border-hairline px-3.5 py-1.5 text-[11px] text-faint">
          <span>
            {project?.name ?? `#${selected.projectId}`} · {selected.label}
          </span>
          <span className="h-[12px] w-px bg-line" />
          <span className="font-mono">
            {[selected.program, ...selected.args].join(" ")}
          </span>
          {message ? (
            <>
              <span className="h-[12px] w-px bg-line" />
              <span>{t(message.key)}</span>
            </>
          ) : null}
          <span className="ml-auto flex items-center gap-1.5">
            <ArrowDownIcon size={11} />
            {t("noLineCap")}
          </span>
        </div>

        <Stream executionId={selected.id} query={filter.query} />
      </div>
    </div>
  );
}
