import { formatLogTime } from "@/features/executions/execution";
import type { LogLine, LogStream } from "@/lib/types";

export type StreamFilter = LogStream | "all";

export type LogFilter = {
  query: string;
  stream: StreamFilter;
};

export const NO_FILTER: LogFilter = { query: "", stream: "all" };

/** One array, shared, for the runs that have no output yet: a selector that
 * builds a fresh `[]` is a selector the store reads as a change every time. */
export const NO_LINES: LogLine[] = [];

export function filterLines(lines: LogLine[], filter: LogFilter): LogLine[] {
  const query = filter.query.trim().toLowerCase();

  return lines.filter((line) => {
    if (filter.stream !== "all" && line.stream !== filter.stream) return false;
    if (query === "") return true;

    return line.text.toLowerCase().includes(query);
  });
}

/** How many lines the query alone matches, so a stream filter cannot hide it. */
export function matchCount(lines: LogLine[], query: string): number {
  const needle = query.trim().toLowerCase();
  if (needle === "") return 0;

  return lines.filter((line) => line.text.toLowerCase().includes(needle))
    .length;
}

/** One line the way the stream draws it, which is also how it is saved. */
export function formatLine(line: LogLine): string {
  const mark = line.stream === "stderr" ? "!" : "▸";

  return `${formatLogTime(line.at)} ${mark} ${line.text}`;
}

export function logText(lines: LogLine[]): string {
  if (lines.length === 0) return "";

  return `${lines.map(formatLine).join("\n")}\n`;
}

/** A filename that says which command wrote it and when. */
export function logName(label: string, startedAt: number): string {
  const date = new Date(startedAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  const safe = label.replace(/[^a-z0-9._-]+/gi, "-");

  return `${safe}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.log`;
}

export function tail(lines: LogLine[], count: number): LogLine[] {
  return lines.length <= count ? lines : lines.slice(-count);
}

/** Where the view should be pinned after new output arrives. */
export function nextScroll(
  pinned: boolean,
  before: number,
  after: number,
): number | null {
  return pinned ? after : before;
}
