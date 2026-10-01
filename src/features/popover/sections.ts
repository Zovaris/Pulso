export const POPOVER_SECTIONS_KEY = "pulso:popover-sections";

export type PopoverSection = "projects" | "commands";

function isSection(value: unknown): value is PopoverSection {
  return value === "projects" || value === "commands";
}

export function readCollapsedSections(): PopoverSection[] {
  try {
    const raw = window.localStorage.getItem(POPOVER_SECTIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSection);
  } catch {
    return [];
  }
}

export function persistCollapsedSections(collapsed: PopoverSection[]): void {
  try {
    window.localStorage.setItem(
      POPOVER_SECTIONS_KEY,
      JSON.stringify(collapsed.filter(isSection)),
    );
  } catch {}
}

export function toggleSection(
  collapsed: PopoverSection[],
  section: PopoverSection,
): PopoverSection[] {
  return collapsed.includes(section)
    ? collapsed.filter((entry) => entry !== section)
    : [...collapsed, section];
}
