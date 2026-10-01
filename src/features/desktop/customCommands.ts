import { isActiveState } from "@/features/executions/execution";
import type { CustomCommand, DetectedCommand, Execution } from "@/lib/types";

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

export function menubarCommands(
  commands: CustomCommand[],
  executions: Execution[],
): CustomCommand[] {
  return commands.filter(
    (command) =>
      command.favorite ||
      executions.some(
        (execution) =>
          execution.commandId === `custom:${command.id}` &&
          isActiveState(execution.state),
      ),
  );
}

export type CustomCommandGroup = {
  key: string;
  projectId: number | null;
  cwd: string;
  commands: CustomCommand[];
};

export function groupCustomCommands(
  commands: CustomCommand[],
): CustomCommandGroup[] {
  const groups = new Map<string, CustomCommandGroup>();

  for (const command of commands) {
    const key =
      command.projectId === null
        ? `cwd:${command.cwd}`
        : `project:${command.projectId}`;
    const existing = groups.get(key);

    if (existing) {
      existing.commands.push(command);
      continue;
    }

    groups.set(key, {
      key,
      projectId: command.projectId,
      cwd: command.cwd,
      commands: [command],
    });
  }

  return [...groups.values()];
}
