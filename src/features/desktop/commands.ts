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

export const FILTERS: CommandFilter[] = [
  "all",
  "favorites",
  "dev",
  "test",
  "lint",
  "hidden",
];

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

export function filterCommands(
  scan: CommandScan,
  filter: CommandFilter,
): DetectedCommand[] {
  const ordered = orderedCommands(scan);

  switch (filter) {
    case "all":
      return ordered;
    case "favorites":
      return ordered.filter(
        (command) => flagsFor(scan.flags, command.id).favorite,
      );
    case "hidden":
      return ordered.filter(
        (command) => flagsFor(scan.flags, command.id).hidden,
      );
    default:
      return ordered.filter((command) => command.category === filter);
  }
}

export function filterCount(scan: CommandScan, filter: CommandFilter): number {
  return filterCommands(scan, filter).length;
}

export function categoryKey(category: DetectedCommand["category"]): string {
  switch (category) {
    case "dev":
      return "categoryDev";
    case "build":
      return "categoryBuild";
    case "test":
      return "categoryTest";
    case "lint":
      return "categoryLint";
    case "database":
      return "categoryDatabase";
    case "infrastructure":
      return "categoryInfrastructure";
    default:
      return "categoryOther";
  }
}

export function invocationOf(command: DetectedCommand): string {
  return [command.program, ...command.args].join(" ");
}

/** The commands of a scan, grouped by the file they were declared in. */
export function scanGroups(scan: CommandScan, filter: CommandFilter) {
  return groupBySource(filterCommands(scan, filter));
}

export function sourcesOf(
  scan: CommandScan,
): { label: string; count: number }[] {
  return groupBySource(scan.commands).map((group) => ({
    label: group.label,
    count: group.commands.length,
  }));
}
