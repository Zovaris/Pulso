import { beforeEach, describe, expect, it } from "vitest";
import {
  persistCollapsedSections,
  readCollapsedSections,
  toggleSection,
} from "./sections";

describe("popover sections", () => {
  beforeEach(() => window.localStorage.clear());

  it("opens everything the first time, projects included", () => {
    expect(readCollapsedSections()).toEqual([]);
  });

  it("remembers what was left folded", () => {
    persistCollapsedSections(["commands"]);

    expect(readCollapsedSections()).toEqual(["commands"]);
  });

  it("folds and unfolds one section without touching the others", () => {
    expect(toggleSection([], "commands")).toEqual(["commands"]);
    expect(toggleSection(["commands"], "projects")).toEqual([
      "commands",
      "projects",
    ]);
    expect(toggleSection(["commands", "projects"], "commands")).toEqual([
      "projects",
    ]);
  });

  it("ignores anything that is not a section", () => {
    persistCollapsedSections(["commands", "invented" as never]);

    expect(readCollapsedSections()).toEqual(["commands"]);
  });

  it("survives a corrupted store instead of throwing", () => {
    window.localStorage.setItem("pulso:popover-sections", "{not json");

    expect(readCollapsedSections()).toEqual([]);
  });
});
