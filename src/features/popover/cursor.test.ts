import { describe, expect, it } from "vitest";
import {
  commandRowKey,
  cursorRows,
  moveCursor,
  projectRowKey,
  rowAt,
} from "@/features/popover/cursor";
import type { CommandScan, DetectedCommand, Project } from "@/lib/types";

function command(id: string, source: string): DetectedCommand {
  return {
    id,
    label: id,
    program: "bun",
    args: ["run", id],
    cwd: "/tmp/project",
    source,
    detector: "package_json",
    category: "build",
    longRunning: false,
  };
}

function project(id: number): Project {
  return {
    id,
    name: `project-${id}`,
    path: `/tmp/project-${id}`,
    availability: "available",
  };
}

const scan: CommandScan = {
  projectId: 1,
  commands: [
    command("dev", "/tmp/package.json"),
    command("test", "/tmp/package.json"),
    command("fmt", "/tmp/Makefile"),
  ],
  status: "detected",
  detail: null,
};

describe("cursorRows", () => {
  it("walks the projects in order", () => {
    const rows = cursorRows([project(1), project(2)], {}, null);

    expect(rows.map((row) => row.key)).toEqual(["project:1", "project:2"]);
  });

  it("opens the commands of the expanded project under it", () => {
    const rows = cursorRows([project(1), project(2)], { "1": scan }, 1);

    expect(rows.map((row) => row.key)).toEqual([
      "project:1",
      "command:1:dev",
      "command:1:test",
      "command:1:fmt",
      "project:2",
    ]);
  });

  it("follows the file groups the list draws", () => {
    const rows = cursorRows([project(1)], { "1": scan }, 1);

    expect(rows[1].key).toBe(commandRowKey(1, "dev"));
    expect(rowAt(rows, commandRowKey(1, "fmt"))?.kind).toBe("command");
  });

  it("ignores a project that was expanded before being read", () => {
    const rows = cursorRows([project(1)], {}, 1);

    expect(rows.map((row) => row.key)).toEqual([projectRowKey(1)]);
  });
});

describe("moveCursor", () => {
  const rows = cursorRows([project(1), project(2)], { "1": scan }, 1);

  it("enters the list from the direction it is moving", () => {
    expect(moveCursor(rows, null, 1)).toBe(projectRowKey(1));
    expect(moveCursor(rows, null, -1)).toBe(projectRowKey(2));
  });

  it("walks one row at a time", () => {
    expect(moveCursor(rows, projectRowKey(1), 1)).toBe(commandRowKey(1, "dev"));
    expect(moveCursor(rows, commandRowKey(1, "dev"), -1)).toBe(
      projectRowKey(1),
    );
  });

  it("stops at both ends", () => {
    expect(moveCursor(rows, projectRowKey(1), -1)).toBe(projectRowKey(1));
    expect(moveCursor(rows, projectRowKey(2), 1)).toBe(projectRowKey(2));
  });

  it("recovers when the row it was on is gone", () => {
    expect(moveCursor(rows, "command:1:gone", 1)).toBe(projectRowKey(1));
    expect(moveCursor(rows, "command:1:gone", -1)).toBe(projectRowKey(2));
  });

  it("has nowhere to go without rows", () => {
    expect(moveCursor([], projectRowKey(1), 1)).toBeNull();
  });
});
