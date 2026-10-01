import { menubarFavourites } from "@/features/desktop/customCommands";
import { groupBySource } from "@/features/popover/commandGroups";
import type { PopoverSection } from "@/features/popover/sections";
import type {
  CommandScan,
  CustomCommand,
  Execution,
  Project,
} from "@/lib/types";

export type CursorRow =
  | { kind: "project"; key: string; projectId: number }
  | {
      kind: "command";
      key: string;
      projectId: number;
      commandId: string;
    };

export function projectRowKey(projectId: number): string {
  return `project:${projectId}`;
}

export function commandRowKey(projectId: number, commandId: string): string {
  return `command:${projectId}:${commandId}`;
}

export function cursorRows(
  projects: Project[],
  scans: Record<string, CommandScan>,
  expandedProjectId: number | null,
  customCommands: CustomCommand[] = [],
  executions: Execution[] = [],
  collapsed: PopoverSection[] = [],
): CursorRow[] {
  const rows: CursorRow[] = [];

  if (!collapsed.includes("projects")) {
    for (const favourite of menubarFavourites(
      scans,
      projects,
      customCommands,
      executions,
    )) {
      rows.push({
        kind: "command",
        key: commandRowKey(favourite.projectId, favourite.command.id),
        projectId: favourite.projectId,
        commandId: favourite.command.id,
      });
    }
  }

  if (!collapsed.includes("projects")) {
    for (const project of projects) {
      rows.push({
        kind: "project",
        key: projectRowKey(project.id),
        projectId: project.id,
      });

      if (project.id !== expandedProjectId) continue;

      const scan = scans[String(project.id)];
      if (!scan) continue;

      for (const group of groupBySource(scan.commands)) {
        for (const command of group.commands) {
          if (command.detector === "custom") continue;
          rows.push({
            kind: "command",
            key: commandRowKey(project.id, command.id),
            projectId: project.id,
            commandId: command.id,
          });
        }
      }
    }
  }

  if (!collapsed.includes("commands")) {
    for (const command of customCommands) {
      // A favourite already sits at the top, and a repeated row would carry the
      // same key twice, which the cursor cannot tell apart.
      if (command.favorite) continue;
      rows.push({
        kind: "command",
        key: commandRowKey(command.projectId ?? 0, `custom:${command.id}`),
        projectId: command.projectId ?? 0,
        commandId: `custom:${command.id}`,
      });
    }
  }

  return rows;
}

export function rowAt(
  rows: CursorRow[],
  cursor: string | null,
): CursorRow | null {
  if (cursor === null) return null;

  return rows.find((row) => row.key === cursor) ?? null;
}

export function moveCursor(
  rows: CursorRow[],
  cursor: string | null,
  delta: number,
): string | null {
  if (rows.length === 0) return null;

  const index =
    cursor === null ? -1 : rows.findIndex((row) => row.key === cursor);

  if (index === -1) {
    return delta > 0 ? rows[0].key : rows[rows.length - 1].key;
  }

  const next = Math.min(rows.length - 1, Math.max(0, index + delta));
  return rows[next].key;
}
