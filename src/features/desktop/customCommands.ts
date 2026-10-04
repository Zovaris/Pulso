import { flagsFor, visibleCommands } from "@/features/desktop/commands";
import { isActiveState } from "@/features/executions/execution";
import type {
  CommandScan,
  CustomCommand,
  DetectedCommand,
  Execution,
  Project,
} from "@/lib/types";

export function customDetected(command: CustomCommand): DetectedCommand {
  return {
    id: `custom:${command.id}`,
    label: command.label,
    program: command.command,
    args: [],
    cwd: command.cwd,
    source: "custom",
    detector: "custom",
    category: "other",
    longRunning: false,
  };
}

export type MenubarFavourite = {
  projectId: number;
  command: DetectedCommand;
};

/**
 * A favourite is a flag, and it lives in two places: on the custom command
 * itself, or in the flags of the scan that found a project command. Both are
 * offered at the top of the menubar, otherwise starring a command in Projects
 * would silently do nothing there.
 */
export function menubarFavourites(
  scans: Record<string, CommandScan>,
  projects: Project[],
  commands: CustomCommand[],
  executions: Execution[],
): MenubarFavourite[] {
  const found: MenubarFavourite[] = [];

  for (const project of projects) {
    const scan = scans[String(project.id)];
    if (!scan) continue;

    for (const command of visibleCommands(scan)) {
      if (!flagsFor(scan.flags, command.id).favorite) continue;
      if (isRunning(command.id, project.id, executions)) continue;

      found.push({ projectId: project.id, command });
    }
  }

  const listed = new Set(
    found.map((entry) => `${entry.projectId}:${entry.command.id}`),
  );
  for (const command of commands) {
    if (!command.favorite) continue;
    if (listed.has(`${command.projectId ?? 0}:custom:${command.id}`)) continue;
    if (isRunning(`custom:${command.id}`, command.projectId ?? 0, executions))
      continue;

    found.push({
      projectId: command.projectId ?? 0,
      command: customDetected(command),
    });
  }

  return found;
}

function isRunning(
  commandId: string,
  projectId: number,
  executions: Execution[],
): boolean {
  return executions.some(
    (execution) =>
      execution.projectId === projectId &&
      execution.commandId === commandId &&
      isActiveState(execution.state),
  );
}
