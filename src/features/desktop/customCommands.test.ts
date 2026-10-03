import { describe, expect, it } from "vitest";
import type { CustomCommand, Execution, Project } from "@/lib/types";
import { customDetected, menubarFavourites } from "./customCommands";

const personal: CustomCommand = {
  id: 1,
  projectId: null,
  label: "Upgrade",
  command: "brew upgrade",
  cwd: "/Users/example",
  favorite: true,
};
describe("custom commands", () => {
  it("run in the folder the user chose, with no arguments of their own", () => {
    expect(customDetected(personal)).toMatchObject({
      id: "custom:1",
      cwd: "/Users/example",
      args: [],
      detector: "custom",
    });
  });
});

describe("menubar favourites", () => {
  const scan = (
    projectId: number,
    commands: { id: string; label: string }[],
    flags: Record<string, { favorite: boolean; hidden: boolean }>,
  ) => ({
    projectId,
    commands: commands.map((command) => ({
      ...command,
      program: "bun",
      args: [],
      cwd: "/tmp",
      source: "package.json",
      detector: "package_json",
      category: "dev" as const,
      longRunning: false,
    })),
    status: "detected" as const,
    detail: null,
    flags,
  });

  const project = (id: number, name: string) =>
    ({ id, name, path: `/p/${name}`, availability: "available" }) as Project;

  it("carries a project favourite to the menubar, not only the custom ones", () => {
    const scans = {
      "7": scan(
        7,
        [
          { id: "7:dev", label: "dev" },
          { id: "7:test", label: "test" },
        ],
        { "7:dev": { favorite: true, hidden: false } },
      ),
    };

    expect(
      menubarFavourites(scans, [project(7, "Pulso")], [], []).map((f) => [
        f.projectId,
        f.command.label,
      ]),
    ).toEqual([[7, "dev"]]);
  });

  it("keeps a hidden favourite out, it has nowhere to show", () => {
    const scans = {
      "7": scan(7, [{ id: "7:dev", label: "dev" }], {
        "7:dev": { favorite: true, hidden: true },
      }),
    };

    expect(menubarFavourites(scans, [project(7, "Pulso")], [], [])).toEqual([]);
  });

  it("drops a favourite that is already running, so it is not listed twice", () => {
    const scans = {
      "7": scan(7, [{ id: "7:dev", label: "dev" }], {
        "7:dev": { favorite: true, hidden: false },
      }),
    };
    const running = {
      projectId: 7,
      commandId: "7:dev",
      state: "running",
    } as Execution;

    expect(
      menubarFavourites(scans, [project(7, "Pulso")], [], [running]),
    ).toEqual([]);
  });

  it("still offers the custom favourites alongside the project ones", () => {
    const scans = {
      "7": scan(7, [{ id: "7:dev", label: "dev" }], {
        "7:dev": { favorite: true, hidden: false },
      }),
    };

    const found = menubarFavourites(
      scans,
      [project(7, "Pulso")],
      [personal],
      [],
    );

    expect(found.map((f) => f.command.label)).toEqual(["dev", "Upgrade"]);
    expect(found[1].projectId).toBe(0);
  });
});
