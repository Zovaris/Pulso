import { describe, expect, it } from "vitest";
import { groupBySource, sourceLabel } from "@/features/popover/commandGroups";
import type { DetectedCommand } from "@/lib/types";

function command(id: string, source: string, label: string): DetectedCommand {
  return {
    id,
    label,
    program: "bun",
    args: ["run", label],
    cwd: "/tmp/project",
    source,
    detector: "package_json",
    category: "other",
    longRunning: false,
  };
}

describe("sourceLabel", () => {
  it("keeps just the file name", () => {
    expect(sourceLabel("/tmp/project/Cargo.toml")).toBe("Cargo.toml");
    expect(sourceLabel("package.json")).toBe("package.json");
    expect(sourceLabel("/tmp/project/")).toBe("/tmp/project/");
  });
});

describe("groupBySource", () => {
  it("keeps the commands of every file together", () => {
    const groups = groupBySource([
      command("dev", "/tmp/project/package.json", "dev"),
      command("test:rust", "/tmp/project/Cargo.toml", "test"),
      command("build", "/tmp/project/package.json", "build"),
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      "package.json",
      "Cargo.toml",
    ]);
    expect(groups[0].commands.map((entry) => entry.id)).toEqual([
      "dev",
      "build",
    ]);
    expect(groups[1].commands.map((entry) => entry.id)).toEqual(["test:rust"]);
  });

  it("orders the files by the first command that shows up", () => {
    const groups = groupBySource([
      command("test", "/tmp/project/Makefile", "test"),
      command("dev", "/tmp/project/package.json", "dev"),
    ]);

    expect(groups.map((group) => group.source)).toEqual([
      "/tmp/project/Makefile",
      "/tmp/project/package.json",
    ]);
  });

  it("loses nothing", () => {
    const commands = [
      command("dev", "package.json", "dev"),
      command("test", "package.json", "test"),
      command("lint", "package.json", "lint"),
    ];

    const groups = groupBySource(commands);

    expect(groups).toHaveLength(1);
    expect(groups[0].commands).toHaveLength(3);
  });

  it("says nothing about no commands", () => {
    expect(groupBySource([])).toEqual([]);
  });
});
