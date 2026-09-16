import type { StateCreator } from "zustand";
import type { Project } from "@/lib/types";
import type { AppStore } from "./types";

export type ProjectsSlice = Pick<AppStore, "projects" | "addProject">;

function projectFromPath(path: string): Project {
  const normalized = path.replace(/[/\\]+$/, "");
  const name = normalized.split(/[/\\]/).pop();

  return { id: normalized, name: name || normalized, path: normalized };
}

/**
 * Projects added during this session. Rust owns canonical paths and SQLite
 * persistence, so this list is a mirror that will be fed by `list_projects`.
 */
export const createProjectsSlice: StateCreator<
  AppStore,
  [],
  [],
  ProjectsSlice
> = (set, get) => ({
  projects: [],
  addProject: (path) => {
    const project = projectFromPath(path);
    if (!project.name) return;
    if (get().projects.some((existing) => existing.id === project.id)) return;

    set({ projects: [...get().projects, project] });
  },
});
