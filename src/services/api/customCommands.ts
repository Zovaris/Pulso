import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { CustomCommand } from "@/lib/types";

export function listCustomCommands(): Promise<CustomCommand[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke("list_custom_commands");
}
export function saveCustomCommand(
  command: CustomCommand,
): Promise<CustomCommand[]> {
  return invoke("save_custom_command", { command });
}
export function deleteCustomCommand(id: number): Promise<CustomCommand[]> {
  return invoke("delete_custom_command", { id });
}
