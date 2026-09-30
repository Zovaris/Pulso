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
