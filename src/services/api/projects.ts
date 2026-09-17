import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { CommandFlags, CommandScan, Project } from "@/lib/types";

export function listProjects(): Promise<Project[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke("list_projects");
}

export function addProject(path: string): Promise<Project> {
  return invoke("add_project", { path });
}

export function removeProject(projectId: number): Promise<void> {
  return invoke("remove_project", { projectId });
}

export function listCommands(projectId: number): Promise<CommandScan> {
  return invoke("list_commands", { projectId });
}

export function rescanProjects(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("rescan_projects");
}

export function rescanProject(projectId: number): Promise<CommandScan> {
  return invoke("rescan_project", { projectId });
}

/** Writes one command's flags and hands back every flag that project has. */
export function setCommandFlag(
  projectId: number,
  commandId: string,
  flags: CommandFlags,
): Promise<Record<string, CommandFlags>> {
  if (!isTauri()) return Promise.resolve({});

  return invoke("set_command_flag", {
    projectId,
    commandId,
    favorite: flags.favorite,
    hidden: flags.hidden,
  });
}
