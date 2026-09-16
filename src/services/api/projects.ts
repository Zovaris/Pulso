import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { CommandScan, Project } from "@/lib/types";

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
