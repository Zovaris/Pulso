import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/tauri";
import type { CommandScan, Execution, LogLine, Project } from "@/lib/types";

export function onProjectsChanged(
  handler: (projects: Project[]) => void,
): Promise<UnlistenFn> {
  return subscribe<{ projects: Project[] }>("project://changed", (payload) =>
    handler(payload.projects),
  );
}

export function onCommandsChanged(
  handler: (scan: CommandScan) => void,
): Promise<UnlistenFn> {
  return subscribe<CommandScan>("project://commands-changed", handler);
}

/** Every state change of an execution, including the terminal one. */
export function onExecutionChanged(
  handler: (execution: Execution) => void,
): Promise<UnlistenFn> {
  return subscribe<Execution>("execution://state-changed", handler);
}

/** Output arrives in batches, so a chatty command cannot flood the channel. */
export function onLogAppended(
  handler: (executionId: number, lines: LogLine[]) => void,
): Promise<UnlistenFn> {
  return subscribe<{ executionId: number; lines: LogLine[] }>(
    "execution://log-appended",
    (payload) => handler(payload.executionId, payload.lines),
  );
}

export function onPopoverShown(handler: () => void): Promise<UnlistenFn> {
  return subscribe<unknown>("popover://shown", handler);
}

async function subscribe<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<T>(event, (message) => handler(message.payload));
}
