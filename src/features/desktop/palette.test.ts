import { describe, expect, it } from "vitest";
import {
  type PaletteRow,
  rowsFrom,
  SUGGESTIONS,
  searchCommands,
} from "@/features/desktop/palette";
import type { CommandScan, Project } from "@/lib/types";

const projects: Project[] = [
  { id: 1, name: "Apex", path: "/tmp/apex", availability: "available" },
  { id: 2, name: "Asterism", path: "/tmp/asterism", availability: "available" },
];

function scan(
  projectId: number,
  commands: { id: string; label: string; program?: string; args?: string[] }[],
  flags: CommandScan["flags"] = {},
): CommandScan {
  return {
    projectId,
    commands: commands.map((command) => ({
      id: command.id,
      label: command.label,
      program: command.program ?? "bun",
      args: command.args ?? ["run", command.label],
      cwd: "/tmp",
      source: "/tmp/package.json",
      detector: "package_json",
      category: "other",
      longRunning: false,
    })),
    status: "detected",
    detail: null,
    flags,
  };
}

const scans: Record<string, CommandScan> = {
  "1": scan(
    1,
    [
      { id: "pkg:test", label: "test" },
      { id: "pkg:build", label: "build" },
      { id: "pkg:dev", label: "dev" },
      { id: "pkg:db:seed", label: "db:seed" },
    ],
    { "pkg:dev": { favorite: true, hidden: false } },
  ),
  "2": scan(2, [
    { id: "cargo:test", label: "test", program: "cargo", args: ["test"] },
  ]),
};

const rows = rowsFrom(projects, scans);

function labels(hits: { label: string }[]): string[] {
  return hits.map((hit) => hit.label);
}

describe("rowsFrom", () => {
  it("offers every command of every project that has been read", () => {
    expect(rows).toHaveLength(5);
  });

  it("forgets a project whose scan has not arrived", () => {
    expect(rowsFrom(projects, { "1": scans["1"] })).toHaveLength(4);
  });

  it("carries the project and the flags along", () => {
    const dev = rows.find((row) => row.label === "dev");

    expect(dev?.project.name).toBe("Apex");
    expect(dev?.favorite).toBe(true);
    expect(dev?.invocation).toBe("bun run dev");
  });
});

describe("searchCommands", () => {
  it("suggests favourites first when nothing has been typed", () => {
    const hits = searchCommands(rows, "");

    expect(hits[0].label).toBe("dev");
    expect(hits).toHaveLength(5);
  });

  it("offers no more than a handful before anything is typed", () => {
    const many: PaletteRow[] = Array.from({ length: 40 }, (_, index) => ({
      project: projects[0],
      scan: scans["1"],
      commandId: `id-${index}`,
      label: `job-${index}`,
      invocation: `bun run job-${index}`,
      favorite: false,
      hidden: false,
    }));

    expect(searchCommands(many, "")).toHaveLength(SUGGESTIONS);
  });

  it("takes an exact label over a prefix", () => {
    expect(searchCommands(rows, "test")[0].project.name).toBe("Apex");
    expect(labels(searchCommands(rows, "test"))).toEqual(["test", "test"]);
  });

  it("prefers a prefix over a match in the middle", () => {
    expect(labels(searchCommands(rows, "db"))).toEqual(["db:seed"]);
  });

  it("finds a command by the program it runs", () => {
    const hits = searchCommands(rows, "cargo");

    expect(hits).toHaveLength(1);
    expect(hits[0].project.name).toBe("Asterism");
  });

  it("cares about case only in the query box", () => {
    expect(labels(searchCommands(rows, "DEV"))).toEqual(["dev"]);
  });

  it("marks a favourite above an exact match in another project", () => {
    const hits = searchCommands(rows, "test");

    expect(hits[0].favorite).toBe(false);
    expect(hits.map((hit) => hit.project.name)).toEqual(["Apex", "Asterism"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(searchCommands(rows, "kubernetes")).toEqual([]);
  });

  it("keeps the order stable for the same query", () => {
    const first = labels(searchCommands(rows, "test"));
    const second = labels(searchCommands(rows, "test"));

    expect(first).toEqual(second);
  });

  it("does not cap what a real query finds", () => {
    const many: PaletteRow[] = Array.from({ length: 20 }, (_, index) => ({
      project: projects[0],
      scan: scans["1"],
      commandId: `id-${index}`,
      label: `job-${index}`,
      invocation: `bun run job-${index}`,
      favorite: false,
      hidden: false,
    }));

    expect(searchCommands(many, "job")).toHaveLength(20);
  });
});
