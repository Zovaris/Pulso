import type { SectionId } from "@/app/stores/types";

export type Section = {
  id: SectionId;
  labelKey: string;
};

export const SECTIONS: Section[] = [
  { id: "overview", labelKey: "sectionOverview" },
  { id: "projects", labelKey: "sectionProjects" },
  { id: "processes", labelKey: "sectionProcesses" },
  { id: "logs", labelKey: "sectionLogs" },
  { id: "settings", labelKey: "sectionSettings" },
];

export function sectionAt(index: number): Section | null {
  return SECTIONS[index] ?? null;
}
