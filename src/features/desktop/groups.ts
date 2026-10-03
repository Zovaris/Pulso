import { type CatalogRow, catalogKey } from "@/features/desktop/catalog";
import {
  isActiveState,
  latestExecution,
} from "@/features/executions/execution";
import type { CommandGroup, Execution } from "@/lib/types";

export type GroupStatus = {
  /** Members that still exist, in the group's order. */
  rows: CatalogRow[];
  running: number;
  total: number;
};

export function groupStatus(
  group: CommandGroup,
  rows: CatalogRow[],
  executions: Execution[],
): GroupStatus {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const members = group.members
    .map((member) => byKey.get(catalogKey(member.projectId, member.commandId)))
    .filter((row): row is CatalogRow => row !== undefined);
  const running = members.filter((row) => {
    const last = latestExecution(executions, row.projectId, row.command.id);
    return last ? isActiveState(last.state) : false;
  }).length;
  return { rows: members, running, total: members.length };
}

/** The running executions of a group's members, oldest member first. */
export function groupRuns(
  group: CommandGroup,
  executions: Execution[],
): Execution[] {
  return group.members
    .map((member) =>
      latestExecution(executions, member.projectId, member.commandId),
    )
    .filter(
      (execution): execution is Execution =>
        execution !== undefined && isActiveState(execution.state),
    );
}
