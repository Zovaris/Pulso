import { flagsFor, invocationOf } from "@/features/desktop/commands";
import type { CommandScan, Project } from "@/lib/types";

export type PaletteRow = {
  project: Project;
  scan: CommandScan | undefined;
  commandId: string;
  label: string;
  invocation: string;
  favorite: boolean;
  hidden: boolean;
};

export type PaletteHit = PaletteRow & {
  score: number;
};

/** How many rows an empty box offers before the user starts narrowing. */
export const SUGGESTIONS = 8;

function rank(row: PaletteRow, query: string): number | null {
  if (query === "") return row.favorite ? 0 : 1;

  const label = row.label.toLowerCase();
  const invocation = row.invocation.toLowerCase();

  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.includes(query)) return 2;
  if (invocation.includes(query)) return 3;

  return null;
}

/**
 * Favourite first, then exact label, then prefix, then anywhere in the label,
 * then anywhere in the invocation. Ties keep the order the projects were added
 * in, so the same query always offers the same thing in the same place.
 */
export function searchCommands(
  rows: PaletteRow[],
  query: string,
): PaletteHit[] {
  const needle = query.trim().toLowerCase();

  const hits: PaletteHit[] = [];
  for (const row of rows) {
    const score = rank(row, needle);
    if (score === null) continue;

    hits.push({ ...row, score: score - (row.favorite ? 0.5 : 0) });
  }

  hits.sort((left, right) => left.score - right.score);

  return needle === "" ? hits.slice(0, SUGGESTIONS) : hits;
}

export function rowsFrom(
  projects: Project[],
  scans: Record<string, CommandScan>,
): PaletteRow[] {
  const rows: PaletteRow[] = [];

  for (const project of projects) {
    const scan = scans[String(project.id)];
    if (!scan) continue;

    for (const command of scan.commands) {
      const flags = flagsFor(scan.flags, command.id);

      rows.push({
        project,
        scan,
        commandId: command.id,
        label: command.label,
        invocation: invocationOf(command),
        favorite: flags.favorite,
        hidden: flags.hidden,
      });
    }
  }

  return rows;
}
