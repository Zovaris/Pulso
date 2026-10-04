import { describe, expect, it } from "vitest";
import {
  catalogRows,
  filterCatalog,
  kindCounts,
  PERSONAL,
} from "@/features/desktop/catalog";
import {
  customDetected,
  menubarFavourites,
} from "@/features/desktop/customCommands";
import type {
  CommandScan,
  CustomCommand,
  DetectedCommand,
  Project,
} from "@/lib/types";

const api: Project = {
  id: 1,
  name: "api",
  path: "/p/api",
  availability: "available",
};
const web: Project = {
  id: 2,
  name: "web",
  path: "/p/web",
  availability: "available",
};

const detected = (label: string): DetectedCommand => ({
  id: `package_json:${label}`,
  label,
  program: "bun",
  args: ["run", label],
  cwd: "/p/api",
  source: "apps/api/package.json",
  detector: "package_json",
  category: "other",
  longRunning: false,
});

const deploy: CustomCommand = {
  id: 7,
  projectId: 1,
  label: "deploy",
  command: "fly deploy",
  cwd: "",
  favorite: true,
};
const brew: CustomCommand = {
  id: 8,
  projectId: null,
  label: "brew",
  command: "brew update",
  cwd: "~",
  favorite: false,
};

/** What the backend sends: a project's custom commands ride inside its scan. */
const scans: Record<string, CommandScan> = {
  "1": {
    projectId: 1,
    status: "detected",
    detail: null,
    commands: [
      detected("dev"),
      detected("test"),
      {
        ...customDetected(deploy),
        program: "/bin/zsh",
        args: ["-c", "fly deploy"],
      },
    ],
    flags: {
      "package_json:test": { favorite: true, hidden: false },
      "package_json:dev": { favorite: false, hidden: true },
      "custom:7": { favorite: true, hidden: false },
    },
  },
};

const rows = () => catalogRows([api, web], scans, [deploy, brew], "Personal");

describe("command catalog", () => {
  it("lists every command once, custom ones included, favourites first and hidden last", () => {
    expect(rows().map((row) => row.key)).toEqual([
      "1:package_json:test",
      "1:custom:7",
      "1:package_json:dev",
      `${PERSONAL}:custom:8`,
    ]);
  });

  it("shows what a custom command runs, not the shell that runs it", () => {
    const row = rows().find((entry) => entry.key === "1:custom:7")!;

    expect(row.invocation).toBe("fly deploy");
    expect(row.origin).toBeNull();
    expect(row.custom).toBe(deploy);
  });

  it("names the file a detected command came from", () => {
    expect(rows()[0].origin).toBe("package.json");
  });

  it("filters by kind, project and every word typed", () => {
    expect(
      filterCatalog(rows(), { kind: "custom", projectId: null, text: "" }).map(
        (row) => row.command.label,
      ),
    ).toEqual(["deploy", "brew"]);
    expect(
      filterCatalog(rows(), { kind: "all", projectId: PERSONAL, text: "" }).map(
        (row) => row.command.label,
      ),
    ).toEqual(["brew"]);
    expect(
      filterCatalog(rows(), {
        kind: "all",
        projectId: null,
        text: "api fly",
      }).map((row) => row.command.label),
    ).toEqual(["deploy"]);
  });

  it("counts each kind", () => {
    const counts = kindCounts(rows(), [
      "all",
      "detected",
      "custom",
      "favorites",
      "hidden",
    ]);

    expect(counts).toEqual({
      all: 4,
      detected: 2,
      custom: 2,
      favorites: 2,
      hidden: 1,
    });
  });

  it("keeps a project's own commands while its scan is still on the way", () => {
    expect(
      catalogRows([api], {}, [deploy], "Personal").map((row) => row.key),
    ).toEqual(["1:custom:7"]);
  });
});

describe("menubar favourites", () => {
  it("offers a starred project command once, though it comes in the scan and the custom list", () => {
    const found = menubarFavourites(scans, [api, web], [deploy, brew], []);

    expect(
      found.filter((entry) => entry.command.id === "custom:7"),
    ).toHaveLength(1);
  });
});
