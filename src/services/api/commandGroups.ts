import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { CommandGroup } from "@/lib/types";

export function listCommandGroups(): Promise<CommandGroup[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke("list_command_groups");
}

export function saveCommandGroup(group: CommandGroup): Promise<CommandGroup[]> {
  return invoke("save_command_group", { group });
}

export function deleteCommandGroup(id: number): Promise<CommandGroup[]> {
  return invoke("delete_command_group", { id });
}
