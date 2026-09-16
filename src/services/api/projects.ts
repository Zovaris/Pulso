import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { CommandScan, Project } from "@/lib/types";

export function listProjects(): Promise<Project[]> {
  // Outside Tauri there is no backend: the UI renders its empty state instead.
  if (!isTauri()) return Promise.resolve([]);
  return invoke("list_projects");
}

export function addProject(path: string): Promise<Project> {
  return invoke("add_project", { path });
}

export function removeProject(projectId: number): Promise<void> {
  return invoke("remove_project", { projectId });
}

/** Re-reads the project's manifests. Detection is never cached in the backend. */
export function listCommands(projectId: number): Promise<CommandScan> {
  return invoke("list_commands", { projectId });
}
