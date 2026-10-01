import { describe, expect, it } from "vitest";
import { cursorRows } from "@/features/popover/cursor";
import type { CustomCommand, Execution } from "@/lib/types";
import {
  customDetected,
  groupCustomCommands,
  menubarCommands,
} from "./customCommands";

const personal: CustomCommand = {
  id: 1,
  projectId: null,
  label: "Upgrade",
  command: "brew upgrade",
  cwd: "/Users/example",
  favorite: true,
};
describe("custom commands in the menubar", () => {
  it("shows favorites and keeps active nonfavorites stoppable", () => {
    const other = { ...personal, id: 2, favorite: false };
    expect(menubarCommands([personal, other], [])).toEqual([personal]);
    const execution = { commandId: "custom:2", state: "running" } as Execution;
    expect(menubarCommands([personal, other], [execution])).toEqual([
      personal,
      other,
    ]);
    expect(
      menubarCommands([other], [{ ...execution, state: "exited" }]),
    ).toEqual([]);
  });
  it("keeps personal favorites reachable with the keyboard without projects", () => {
    expect(customDetected(personal).args).toEqual([]);
    expect(cursorRows([], {}, null, [personal])).toEqual([
      {
        kind: "command",
        key: "command:0:custom:1",
        projectId: 0,
        commandId: "custom:1",
      },
    ]);
  });
});

describe("grouping custom commands", () => {
  const scoped = (id: number, projectId: number | null, cwd: string) => ({
    ...personal,
    id,
    projectId,
    cwd,
    favorite: false,
  });

  it("states the personal folder once instead of on every row", () => {
    const groups = groupCustomCommands([
      scoped(1, null, "/Users/example"),
      scoped(2, null, "/Users/example"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].cwd).toBe("/Users/example");
    expect(groups[0].commands.map((c) => c.id)).toEqual([1, 2]);
  });

  it("splits personal commands that live in different folders", () => {
    const groups = groupCustomCommands([
      scoped(1, null, "/Users/example"),
      scoped(2, null, "/tmp"),
    ]);

    expect(groups.map((g) => g.cwd)).toEqual(["/Users/example", "/tmp"]);
  });

  it("groups project commands by project, not by folder", () => {
    const groups = groupCustomCommands([
      scoped(1, 7, "/a/project"),
      scoped(2, 7, "/a/project"),
      scoped(3, 8, "/a/other"),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].projectId).toBe(7);
    expect(groups[0].commands).toHaveLength(2);
  });

  it("keeps a group where it first appeared", () => {
    const groups = groupCustomCommands([
      scoped(1, null, "/second"),
      scoped(2, null, "/first"),
      scoped(3, null, "/second"),
    ]);

    expect(groups.map((g) => g.cwd)).toEqual(["/second", "/first"]);
  });
});
