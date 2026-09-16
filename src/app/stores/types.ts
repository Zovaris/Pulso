import type { TplVars } from "@/lib/i18n";
import type {
  BackendError,
  CommandScan,
  Locale,
  Project,
  Surface,
  ThemePref,
} from "@/lib/types";

export type StoreState = {
  surface: Surface;
  locale: Locale;
  themePref: ThemePref;
  transparency: boolean;

  projects: Project[];
  /** The last scan of each project, keyed by project id. */
  scans: Record<string, CommandScan>;
  scanningProjectId: number | null;
  /** Frontend-only: which row is open. Never persisted. */
  expandedProjectId: number | null;
  projectError: BackendError | null;
};

export type StoreActions = {
  setLocale: (locale: Locale) => void;
  setThemePref: (pref: ThemePref) => void;
  setTransparency: (value: boolean) => void;
  /** Reconciles the `localStorage` boot cache with the record in Rust. */
  hydrateAppearance: () => Promise<void>;
  t: (key: string, vars?: TplVars) => string;

  loadProjects: () => Promise<void>;
  addProject: (path: string) => Promise<Project | null>;
  removeProject: (projectId: number) => Promise<void>;
  loadCommands: (projectId: number) => Promise<void>;
  toggleProject: (projectId: number) => void;
  /** Applied from `project://changed`, which carries the whole list. */
  applyProjects: (projects: Project[]) => void;
  /** Applied from `project://commands-changed`. */
  applyScan: (scan: CommandScan) => void;
  dismissProjectError: () => void;
};

export type AppStore = StoreState & StoreActions;
