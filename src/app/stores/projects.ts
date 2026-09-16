import type { StateCreator } from "zustand";
import type { Project } from "@/lib/types";
import { toBackendError } from "@/services/api/errors";
import * as projectsApi from "@/services/api/projects";
import type { AppStore } from "./types";

export type ProjectsSlice = Pick<
  AppStore,
  | "projects"
  | "scans"
  | "scanningProjectId"
  | "expandedProjectId"
  | "projectError"
  | "loadProjects"
  | "addProject"
  | "removeProject"
  | "loadCommands"
  | "toggleProject"
  | "applyProjects"
  | "applyScan"
  | "dismissProjectError"
>;

const key = (projectId: number) => String(projectId);

function upsert(projects: Project[], project: Project): Project[] {
  const index = projects.findIndex((existing) => existing.id === project.id);
  if (index === -1) return [...projects, project];

  const next = [...projects];
  next[index] = project;
  return next;
}

/**
 * A projection of what Rust owns, never a second source of truth. Every write
 * goes through a command and is confirmed by its return value or by an event;
 * nothing here is persisted.
 */
export const createProjectsSlice: StateCreator<
  AppStore,
  [],
  [],
  ProjectsSlice
> = (set, get) => ({
  projects: [],
  scans: {},
  scanningProjectId: null,
  expandedProjectId: null,
  projectError: null,

  applyProjects: (projects) => set({ projects }),

  applyScan: (scan) =>
    set((state) => ({
      scans: { ...state.scans, [key(scan.projectId)]: scan },
    })),

  loadProjects: async () => {
    try {
      set({ projects: await projectsApi.listProjects(), projectError: null });
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    }
  },

  addProject: async (path) => {
    try {
      const project = await projectsApi.addProject(path);
      set((state) => ({
        projects: upsert(state.projects, project),
        // The new project opens itself: the point of adding a folder is seeing
        // what Soffy found in it.
        expandedProjectId: project.id,
        projectError: null,
      }));
      void get().loadCommands(project.id);
      return project;
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
      return null;
    }
  },

  removeProject: async (projectId) => {
    try {
      await projectsApi.removeProject(projectId);
      set((state) => {
        const scans = { ...state.scans };
        delete scans[key(projectId)];

        return {
          projects: state.projects.filter(
            (project) => project.id !== projectId,
          ),
          scans,
          expandedProjectId:
            state.expandedProjectId === projectId
              ? null
              : state.expandedProjectId,
          projectError: null,
        };
      });
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    }
  },

  loadCommands: async (projectId) => {
    set({ scanningProjectId: projectId });
    try {
      get().applyScan(await projectsApi.listCommands(projectId));
    } catch (cause) {
      set({ projectError: toBackendError(cause) });
    } finally {
      set((state) => ({
        scanningProjectId:
          state.scanningProjectId === projectId
            ? null
            : state.scanningProjectId,
      }));
    }
  },

  toggleProject: (projectId) => {
    const wasOpen = get().expandedProjectId === projectId;
    set({ expandedProjectId: wasOpen ? null : projectId });
    if (!wasOpen) void get().loadCommands(projectId);
  },

  dismissProjectError: () => set({ projectError: null }),
});
