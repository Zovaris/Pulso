import type { TplVars } from "@/lib/i18n";
import type {
  BackendError,
  CommandScan,
  Execution,
  Locale,
  LogLine,
  Preferences,
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

  scans: Record<string, CommandScan>;
  scanningProjectId: number | null;

  expandedProjectId: number | null;
  projectError: BackendError | null;

  executions: Execution[];
  pendingCommandId: string | null;

  logs: Record<number, LogLine[]>;
  openLogKey: string | null;
};

export type StoreActions = {
  setLocale: (locale: Locale) => void;
  setThemePref: (pref: ThemePref) => void;
  setTransparency: (value: boolean) => void;

  hydratePreferences: () => Promise<void>;
  applyPreferences: (preferences: Preferences) => void;
  t: (key: string, vars?: TplVars) => string;

  loadProjects: () => Promise<void>;
  addProject: (path: string) => Promise<Project | null>;
  removeProject: (projectId: number) => Promise<void>;
  loadCommands: (projectId: number) => Promise<void>;
  toggleProject: (projectId: number) => void;

  applyProjects: (projects: Project[]) => void;

  applyScan: (scan: CommandScan) => void;
  dismissProjectError: () => void;

  loadExecutions: () => Promise<void>;
  applyExecution: (execution: Execution) => void;
  startCommand: (projectId: number, commandId: string) => Promise<void>;
  stopExecution: (executionId: number) => Promise<void>;

  applyLogs: (executionId: number, lines: LogLine[]) => void;
  loadLogs: (executionId: number) => Promise<void>;
  toggleLogs: (key: string, executionId: number | null) => void;
  closeLogs: () => void;
  openUrl: (executionId: number, portId: string) => Promise<void>;
};

export type AppStore = StoreState & StoreActions;
