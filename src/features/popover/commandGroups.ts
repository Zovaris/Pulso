import type { DetectedCommand } from "@/lib/types";

export type CommandGroup = {
  source: string;
  label: string;
  commands: DetectedCommand[];
};

export function sourceLabel(source: string): string {
  const parts = source.split("/");
  const name = parts[parts.length - 1];

  return name === "" ? source : name;
}

export function groupBySource(commands: DetectedCommand[]): CommandGroup[] {
  const groups = new Map<string, CommandGroup>();

  for (const command of commands) {
    const group = groups.get(command.source);

    if (group) {
      group.commands.push(command);
      continue;
    }

    groups.set(command.source, {
      source: command.source,
      label: sourceLabel(command.source),
      commands: [command],
    });
  }

  return [...groups.values()];
}
