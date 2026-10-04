import type { SectionId } from "@/app/stores/types";

export type Section = {
  id: SectionId;
  labelKey: string;
};

/**
 * In sidebar order: the sections, then the project list (⌘6 opens the selected
 * project). Settings sits apart, at the foot of the sidebar and on ⌘,.
 */
export const SECTIONS: Section[] = [
  { id: "overview", labelKey: "sectionOverview" },
  { id: "commands", labelKey: "sectionCommands" },
  { id: "processes", labelKey: "sectionProcesses" },
  { id: "ports", labelKey: "sectionPorts" },
  { id: "logs", labelKey: "sectionLogs" },
  { id: "projects", labelKey: "sectionProjects" },
  { id: "settings", labelKey: "sectionSettings" },
];

/** The sections ⌘1… reach, numbered as the sidebar shows them. */
export const NUMBERED = SECTIONS.filter((section) => section.id !== "settings");

export function sectionAt(index: number): Section | null {
  return NUMBERED[index] ?? null;
}

export function shortcutOf(id: SectionId): string[] {
  if (id === "settings") return ["⌘", ","];
  const index = NUMBERED.findIndex((section) => section.id === id);
  return index === -1 ? [] : ["⌘", String(index + 1)];
}
