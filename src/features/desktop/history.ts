import { formatDuration, isActiveState } from "@/features/executions/execution";
import type {
  Execution,
  ExecutionState,
  HistoryEntry,
  Locale,
} from "@/lib/types";

/** How many runs the timeline asks for at a time. */
export const HISTORY_RUNS = 30;

export type TimelineRun = {
  key: string;
  source: "session" | "history";
  id: number;
  label: string;
  commandId: string;
  state: ExecutionState;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  detail: string | null;
  lines: number;
};

function fromExecution(execution: Execution): TimelineRun {
  return {
    key: `s:${execution.id}`,
    source: "session",
    id: execution.id,
    label: execution.label,
    commandId: execution.commandId,
    state: execution.state,
    startedAt: execution.startedAt,
    endedAt: execution.endedAt,
    exitCode: execution.exitCode,
    detail: execution.detail,
    lines: 0,
  };
}

function fromHistory(entry: HistoryEntry): TimelineRun {
  return {
    key: `h:${entry.id}`,
    source: "history",
    id: entry.id,
    label: entry.label,
    commandId: entry.commandId,
    state: entry.state,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    exitCode: entry.exitCode,
    detail: entry.detail,
    lines: entry.lines,
  };
}

/** A run that just finished is in memory and in the file at once; the one the
 * session still holds is the one with the fresher answer. */
function alreadyInMemory(run: TimelineRun, inMemory: TimelineRun[]): boolean {
  return inMemory.some(
    (live) =>
      live.commandId === run.commandId && live.startedAt === run.startedAt,
  );
}

export function timeline(
  executions: Execution[],
  history: HistoryEntry[],
  projectId: number,
  limit = 6,
): TimelineRun[] {
  const inMemory = executions
    .filter((execution) => execution.projectId === projectId)
    .map(fromExecution);

  const stored = history
    .filter((entry) => entry.projectId === projectId)
    .map(fromHistory)
    .filter((run) => !alreadyInMemory(run, inMemory));

  return [...inMemory, ...stored]
    .sort((left, right) => right.startedAt - left.startedAt)
    .slice(0, limit);
}

export type RunBadge = {
  text: string;
  tone: "ok" | "bad" | "none";
};

export function runBadge(run: TimelineRun): RunBadge {
  if (isActiveState(run.state)) return { text: "·", tone: "none" };
  if (run.exitCode === null) {
    return run.state === "interrupted"
      ? { text: "—", tone: "none" }
      : { text: "!", tone: "bad" };
  }

  return {
    text: String(run.exitCode),
    tone: run.exitCode === 0 ? "ok" : "bad",
  };
}

export function runDuration(run: TimelineRun, now = Date.now()): string {
  return formatDuration((run.endedAt ?? now) - run.startedAt);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** The clock time for today, the date for anything older, because a timeline
 * that crosses days needs to say which day it crossed. */
export function runStamp(
  startedAt: number,
  now: number,
  locale: Locale,
): string {
  const date = new Date(startedAt);
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const today = new Date(now);

  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) return clock;

  const day = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  return `${day} ${clock}`;
}
