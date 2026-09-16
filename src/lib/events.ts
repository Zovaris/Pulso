import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/tauri";
import type { CommandScan, Project } from "@/lib/types";

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

async function subscribe<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<T>(event, (message) => handler(message.payload));
}
