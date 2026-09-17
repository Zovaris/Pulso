import { describe, expect, it } from "vitest";
import {
  categoryKey,
  filterCommands,
  filterCount,
  flagsFor,
  invocationOf,
  orderedCommands,
  sourcesOf,
  visibleCommands,
} from "@/features/desktop/commands";
import type {
  CommandCategory,
  CommandScan,
  DetectedCommand,
} from "@/lib/types";

function command(
  id: string,
  label: string,
  category: CommandCategory = "other",
): DetectedCommand {
  return {
    id,
    label,
    program: "bun",
    args: ["run", label],
    cwd: "/tmp/one",
    source: "/tmp/one/package.json",
    detector: "package_json",
    category,
    longRunning: false,
  };
}

function scan(
  commands: DetectedCommand[],
  flags: CommandScan["flags"] = {},
): CommandScan {
  return {
    projectId: 1,
    commands,
    status: "detected",
    detail: null,
    flags,
  };
}

const full = scan(
  [
    command("package_json:dev", "dev", "dev"),
    command("package_json:test", "test", "test"),
    command("package_json:lint", "lint", "lint"),
    command("package_json:seed", "seed", "database"),
  ],
  {
    "package_json:test": { favorite: true, hidden: false },
    "package_json:lint": { favorite: false, hidden: true },
  },
);

describe("flagsFor", () => {
  it("answers with no flags for a command nobody touched", () => {
    expect(flagsFor(full.flags, "package_json:dev")).toEqual({
      favorite: false,
      hidden: false,
    });
  });

  it("survives a scan from before flags existed", () => {
    expect(flagsFor(undefined, "package_json:dev").favorite).toBe(false);
  });
});

describe("orderedCommands", () => {
  it("puts favourites first and hidden last", () => {
    expect(orderedCommands(full).map((entry) => entry.label)).toEqual([
      "test",
      "dev",
      "seed",
      "lint",
    ]);
  });

  it("keeps the detector order inside each group", () => {
    const plain = scan([
      command("a", "a"),
      command("b", "b"),
      command("c", "c"),
    ]);

    expect(orderedCommands(plain).map((entry) => entry.label)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("visibleCommands", () => {
  it("leaves the hidden ones out, which is what the menubar shows", () => {
    expect(visibleCommands(full).map((entry) => entry.label)).toEqual([
      "test",
      "dev",
      "seed",
    ]);
  });
});

describe("filterCommands", () => {
  it("shows everything, hidden included", () => {
    expect(filterCommands(full, "all")).toHaveLength(4);
  });

  it("filters by what the user starred", () => {
    expect(
      filterCommands(full, "favorites").map((entry) => entry.label),
    ).toEqual(["test"]);
  });

  it("filters by hidden", () => {
    expect(filterCommands(full, "hidden").map((entry) => entry.label)).toEqual([
      "lint",
    ]);
  });

  it("filters by category", () => {
    expect(filterCommands(full, "dev").map((entry) => entry.label)).toEqual([
      "dev",
    ]);
    expect(filterCommands(full, "test").map((entry) => entry.label)).toEqual([
      "test",
    ]);
    expect(filterCommands(full, "lint").map((entry) => entry.label)).toEqual([
      "lint",
    ]);
  });

  it("counts what each chip would show", () => {
    expect(filterCount(full, "all")).toBe(4);
    expect(filterCount(full, "favorites")).toBe(1);
    expect(filterCount(full, "test")).toBe(1);
    expect(filterCount(full, "hidden")).toBe(1);
  });
});

describe("categoryKey", () => {
  it("names every category the backend can send", () => {
    const categories: CommandCategory[] = [
      "dev",
      "build",
      "test",
      "lint",
      "database",
      "infrastructure",
      "other",
    ];

    for (const category of categories) {
      expect(categoryKey(category)).toMatch(/^category[A-Z]/);
    }
  });
});

describe("sourcesOf", () => {
  it("counts the files a project was read from", () => {
    expect(sourcesOf(full)).toEqual([{ label: "package.json", count: 4 }]);
  });

  it("names each file once, in the order it was found", () => {
    const mixed = scan([
      { ...command("a", "a"), source: "/tmp/one/package.json" },
      { ...command("b", "b"), source: "/tmp/one/Cargo.toml" },
      { ...command("c", "c"), source: "/tmp/one/package.json" },
    ]);

    expect(sourcesOf(mixed)).toEqual([
      { label: "package.json", count: 2 },
      { label: "Cargo.toml", count: 1 },
    ]);
  });
});

describe("invocationOf", () => {
  it("joins the program with its arguments", () => {
    expect(invocationOf(command("a", "dev"))).toBe("bun run dev");
  });
});
