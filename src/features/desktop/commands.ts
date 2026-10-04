import { groupBySource } from "@/features/popover/commandGroups";
import {
  type CommandFlags,
  type CommandScan,
  type DetectedCommand,
  NO_FLAGS,
} from "@/lib/types";

export type CommandFilter =
  | "all"
  | "favorites"
  | "dev"
  | "test"
  | "lint"
  | "hidden";

export function flagsFor(
  flags: Record<string, CommandFlags> | undefined,
  commandId: string,
): CommandFlags {
  return flags?.[commandId] ?? NO_FLAGS;
}

/**
 * Favourites first, hidden last, and everything else exactly where the detector
 * put it, so a rescan never reshuffles what the user was reading.
 */
export function orderedCommands(scan: CommandScan): DetectedCommand[] {
  return scan.commands
    .map((command, index) => ({ command, index }))
    .sort((left, right) => {
      const difference = rank(scan, left.command) - rank(scan, right.command);

      return difference === 0 ? left.index - right.index : difference;
    })
    .map((entry) => entry.command);
}

function rank(scan: CommandScan, command: DetectedCommand): number {
  const flags = flagsFor(scan.flags, command.id);
  if (flags.hidden) return 2;

  return flags.favorite ? 0 : 1;
}

export function visibleCommands(scan: CommandScan): DetectedCommand[] {
  return orderedCommands(scan).filter(
    (command) => !flagsFor(scan.flags, command.id).hidden,
  );
}

export function invocationOf(command: DetectedCommand): string {
  return [command.program, ...command.args].join(" ");
}

export function sourcesOf(
  scan: CommandScan,
): { label: string; count: number }[] {
  return groupBySource(scan.commands).map((group) => ({
    label: group.label,
    count: group.commands.length,
  }));
}
