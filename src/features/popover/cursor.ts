import { groupBySource } from "@/features/popover/commandGroups";
import type { CommandScan, Project } from "@/lib/types";

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
): CursorRow[] {
  const rows: CursorRow[] = [];

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
        rows.push({
          kind: "command",
          key: commandRowKey(project.id, command.id),
          projectId: project.id,
          commandId: command.id,
        });
      }
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
