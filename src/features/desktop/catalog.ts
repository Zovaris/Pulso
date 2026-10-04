import {
  flagsFor,
  invocationOf,
  orderedCommands,
} from "@/features/desktop/commands";
import { customDetected } from "@/features/desktop/customCommands";
import type {
  CommandScan,
  CustomCommand,
  DetectedCommand,
  Project,
} from "@/lib/types";

/** Personal commands belong to no project; executions file them under 0. */
export const PERSONAL = 0;

export type CatalogKind =
  | "all"
  | "detected"
  | "custom"
  | "favorites"
  | "hidden";

export type CatalogRow = {
  key: string;
  projectId: number;
  projectName: string;
  command: DetectedCommand;
  /** Set for a command the user wrote; only those can be edited or deleted. */
  custom: CustomCommand | null;
  invocation: string;
  /** The file it was declared in, or null for a custom command. */
  origin: string | null;
  favorite: boolean;
  hidden: boolean;
};

export type CatalogQuery = {
  kind: CatalogKind;
  /** A project id, PERSONAL, or null for every scope. */
  projectId: number | null;
  text: string;
};

export function catalogKey(projectId: number, commandId: string): string {
  return `${projectId}:${commandId}`;
}

/**
 * Every command Pulso can run, once each: what the scans found, the custom
 * commands a scan already carries for its project, then the personal ones.
 * Within a project the order is the scan's own, favourites first, hidden last.
 */
export function catalogRows(
  projects: Project[],
  scans: Record<string, CommandScan>,
  customs: CustomCommand[],
  personalName: string,
): CatalogRow[] {
  const rows: CatalogRow[] = [];
  const seen = new Set<string>();
  const customFor = (commandId: string) =>
    customs.find((entry) => `custom:${entry.id}` === commandId) ?? null;
  const push = (
    project: Project | null,
    command: DetectedCommand,
    favorite: boolean,
    hidden: boolean,
  ) => {
    const projectId = project?.id ?? PERSONAL;
    const key = catalogKey(projectId, command.id);
    if (seen.has(key)) return;
    seen.add(key);
    const custom = command.detector === "custom" ? customFor(command.id) : null;
    rows.push({
      key,
      projectId,
      projectName: project?.name ?? personalName,
      command,
      custom,
      invocation: custom ? custom.command : invocationOf(command),
      origin:
        custom || command.detector === "custom"
          ? null
          : (command.source.split("/").pop() ?? command.source),
      favorite: custom ? custom.favorite : favorite,
      hidden,
    });
  };

  for (const project of projects) {
    const scan = scans[String(project.id)];
    for (const command of scan ? orderedCommands(scan) : []) {
      const flags = flagsFor(scan?.flags, command.id);
      push(project, command, flags.favorite, flags.hidden);
    }
    for (const custom of customs.filter(
      (entry) => entry.projectId === project.id,
    ))
      push(project, customDetected(custom), custom.favorite, false);
  }
  for (const custom of customs.filter((entry) => entry.projectId === null))
    push(null, customDetected(custom), custom.favorite, false);

  return rows;
}

export function matchesKind(row: CatalogRow, kind: CatalogKind): boolean {
  switch (kind) {
    case "detected":
      return row.custom === null;
    case "custom":
      return row.custom !== null;
    case "favorites":
      return row.favorite;
    case "hidden":
      return row.hidden;
    default:
      return true;
  }
}

export function filterCatalog(
  rows: CatalogRow[],
  query: CatalogQuery,
): CatalogRow[] {
  const words = query.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (query.projectId !== null && row.projectId !== query.projectId)
      return false;
    if (!matchesKind(row, query.kind)) return false;
    const text =
      `${row.command.label} ${row.invocation} ${row.projectName} ${row.origin ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function kindCounts(
  rows: CatalogRow[],
  kinds: CatalogKind[],
): Record<CatalogKind, number> {
  const counts = { all: 0, detected: 0, custom: 0, favorites: 0, hidden: 0 };
  for (const kind of kinds)
    counts[kind] = rows.filter((row) => matchesKind(row, kind)).length;
  return counts;
}
