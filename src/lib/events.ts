import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Theme } from "@tauri-apps/api/window";
import { isTauri } from "@/lib/tauri";
import type {
  CommandFlags,
  CommandGroup,
  CommandScan,
  CustomCommand,
  Execution,
  LogLine,
  MetricsSample,
  Preferences,
  Project,
} from "@/lib/types";

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

/** Toggling a favourite in either window reaches the other one. */
export function onCommandFlagsChanged(
  handler: (projectId: number, flags: Record<string, CommandFlags>) => void,
): Promise<UnlistenFn> {
  return subscribe<{ projectId: number; flags: Record<string, CommandFlags> }>(
    "project://flags-changed",
    (payload) => handler(payload.projectId, payload.flags),
  );
}

/** One reading per live process group, every two seconds. */
export function onExecutionMetrics(
  handler: (samples: MetricsSample[]) => void,
): Promise<UnlistenFn> {
  return subscribe<{ samples: MetricsSample[] }>(
    "execution://metrics",
    (payload) => handler(payload.samples),
  );
}

/** Every state change of an execution, including the terminal one. */
export function onExecutionsRemoved(
  handler: (ids: number[]) => void,
): Promise<UnlistenFn> {
  return subscribe<number[]>("execution://removed", handler);
}

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

export function onPopoverPrepare(handler: () => void): Promise<UnlistenFn> {
  return subscribe<unknown>("popover://prepare", handler);
}

/** Theme, transparency and language, so both windows cannot drift apart. */
export function onPreferencesChanged(
  handler: (preferences: Preferences) => void,
): Promise<UnlistenFn> {
  return subscribe<Preferences>("settings://changed", handler);
}

/**
 * macOS reporting the appearance change itself, which still arrives when the
 * webview has not re-evaluated its media query.
 */
export async function onSystemThemeChanged(
  handler: (theme: Theme) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().onThemeChanged(({ payload }) => handler(payload));
}

async function subscribe<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<T>(event, (message) => handler(message.payload));
}

export function onFailuresSeen(
  handler: (seenAt: number) => void,
): Promise<UnlistenFn> {
  return subscribe<number>("failures://seen", handler);
}

export function onCommandGroupsChanged(
  handler: (groups: CommandGroup[]) => void,
): Promise<UnlistenFn> {
  return subscribe<CommandGroup[]>("command-group://changed", handler);
}

export function onCustomCommandsChanged(
  handler: (commands: CustomCommand[]) => void,
): Promise<UnlistenFn> {
  return subscribe<CustomCommand[]>("custom-command://changed", handler);
}
