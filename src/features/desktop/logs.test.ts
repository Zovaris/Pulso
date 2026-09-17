import { describe, expect, it } from "vitest";
import {
  filterLines,
  formatLine,
  logName,
  logText,
  matchCount,
  NO_FILTER,
  nextScroll,
  tail,
} from "@/features/desktop/logs";
import type { LogLine, LogStream } from "@/lib/types";

let seq = 0;

function line(text: string, stream: LogStream = "stdout"): LogLine {
  seq += 1;

  return { seq, at: 1_700_000_000_000 + seq * 1000, stream, text };
}

const lines = [
  line("building client"),
  line("compiled client in 412ms"),
  line("warning: unused selector", "stderr"),
  line("error: could not resolve ./missing", "stderr"),
  line("compiled server in 96ms"),
];

describe("filterLines", () => {
  it("keeps everything with no filter at all", () => {
    expect(filterLines(lines, NO_FILTER)).toHaveLength(5);
  });

  it("searches without caring about case", () => {
    expect(
      filterLines(lines, { query: "COMPILED", stream: "all" }),
    ).toHaveLength(2);
  });

  it("ignores a query that is only spaces", () => {
    expect(filterLines(lines, { query: "   ", stream: "all" })).toHaveLength(5);
  });

  it("narrows to one stream", () => {
    expect(filterLines(lines, { query: "", stream: "stderr" })).toHaveLength(2);
  });

  it("combines the stream with the query", () => {
    const found = filterLines(lines, { query: "compiled", stream: "stdout" });

    expect(found).toHaveLength(2);
    expect(found.every((entry) => entry.stream === "stdout")).toBe(true);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterLines(lines, { query: "nope", stream: "all" })).toHaveLength(
      0,
    );
  });
});

describe("matchCount", () => {
  it("counts the query on its own, whatever the stream filter says", () => {
    expect(matchCount(lines, "compiled")).toBe(2);
  });

  it("says nothing was searched when the box is empty", () => {
    expect(matchCount(lines, "")).toBe(0);
    expect(matchCount(lines, "  ")).toBe(0);
  });
});

describe("logText", () => {
  it("writes exactly what is visible, in order", () => {
    const visible = filterLines(lines, { query: "compiled", stream: "all" });
    const text = logText(visible);
    const written = text.trimEnd().split("\n");

    expect(written).toHaveLength(2);
    expect(written[0]).toContain("compiled client in 412ms");
    expect(written[1]).toContain("compiled server in 96ms");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("writes an empty file when nothing is visible", () => {
    expect(logText([])).toBe("");
  });

  it("marks a stderr line so the file keeps the distinction", () => {
    expect(formatLine(line("boom", "stderr"))).toContain("! boom");
    expect(formatLine(line("ready"))).toContain("▸ ready");
  });
});

describe("logName", () => {
  it("names the file after the command and the moment", () => {
    expect(logName("dev:playground", 1_700_000_000_000)).toMatch(
      /^dev-playground-\d{8}-\d{4}\.log$/,
    );
  });

  it("cannot escape the folder it is written to", () => {
    expect(logName("../../etc/passwd", 1_700_000_000_000)).not.toContain("/");
  });
});

describe("tail", () => {
  it("keeps the last lines when there are too many", () => {
    expect(tail(lines, 2).map((entry) => entry.text)).toEqual([
      "error: could not resolve ./missing",
      "compiled server in 96ms",
    ]);
  });

  it("keeps everything when there are few", () => {
    expect(tail(lines, 99)).toHaveLength(5);
  });
});

describe("nextScroll", () => {
  it("follows the output while the reader is at the bottom", () => {
    expect(nextScroll(true, 100, 420)).toBe(420);
  });

  it("holds still while the reader is reading", () => {
    expect(nextScroll(false, 100, 420)).toBe(100);
  });
});
