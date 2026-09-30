import { describe, expect, it } from "vitest";
import { cursorRows } from "@/features/popover/cursor";
import type { CustomCommand, Execution } from "@/lib/types";
import { customDetected, menubarCommands } from "./customCommands";

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
