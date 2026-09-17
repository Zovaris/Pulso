import type { CommandFilter } from "@/features/desktop/commands";
import type { LogFilter } from "@/features/desktop/logs";
import type { TplVars } from "@/lib/i18n";
import type {
  BackendError,
  CommandFlags,
  CommandScan,
  DataStatus,
  EditorTarget,
  EnvironmentReport,
  Execution,
  HistoryEntry,
  Locale,
  LogLine,
  MetricsSample,
  Preferences,
  Project,
  Surface,
  ThemePref,
} from "@/lib/types";

export type SectionId =
  | "overview"
  | "projects"
  | "processes"
  | "logs"
  | "settings";

export type StoreState = {
  surface: Surface;
  section: SectionId;
  locale: Locale;
  themePref: ThemePref;
  transparency: boolean;
  sound: boolean;
  editor: string | null;
  openAtLogin: boolean;
  keepRunning: boolean;
  confirmStop: boolean;
  notifyOnFailure: boolean;
  logLines: number;

  projects: Project[];

  scans: Record<string, CommandScan>;
  scanningProjectId: number | null;
  rescanning: boolean;

  expandedProjectId: number | null;
  projectError: BackendError | null;

  executions: Execution[];
  pendingCommandId: string | null;
  metrics: Record<number, MetricsSample>;
  histories: Record<number, number[]>;

  logs: Record<number, LogLine[]>;
  openLogKey: string | null;

  cursor: string | null;

  editors: EditorTarget[];
  icons: Record<string, string>;
  selectedExecutionId: number | null;
  selectedProjectId: number | null;
  commandFilter: CommandFilter;
  logFilter: LogFilter;
  logAutoscroll: boolean;
  paletteOpen: boolean;
  confirmingStop: number | null;
  argsFor: string | null;
  data: DataStatus | null;
  environment: EnvironmentReport | null;
  environmentFor: number | null;
  history: HistoryEntry[];
  historyProject: number | null;
  historyLog: HistoryLog | null;
  confirmingHistory: boolean;
  working: string | null;
  notice: string | null;
  seenFailuresAt: number;
};

export type StoreActions = {
  setSection: (section: SectionId) => void;
  setLocale: (locale: Locale) => void;
  setThemePref: (pref: ThemePref) => void;
  setTransparency: (value: boolean) => void;
  setSound: (value: boolean) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;

  hydratePreferences: () => Promise<void>;
  applyPreferences: (preferences: Preferences) => void;
  t: (key: string, vars?: TplVars) => string;

  loadProjects: () => Promise<void>;
  addProject: (path: string) => Promise<Project | null>;
  removeProject: (projectId: number) => Promise<void>;
  loadCommands: (projectId: number) => Promise<void>;
  rescanProjects: () => Promise<void>;
  rescanProject: (projectId: number) => Promise<void>;
  toggleProject: (projectId: number) => void;

  applyProjects: (projects: Project[]) => void;

  applyScan: (scan: CommandScan) => void;
  applyFlags: (projectId: number, flags: Record<string, CommandFlags>) => void;
  setCommandFlag: (
    projectId: number,
    commandId: string,
    patch: Partial<CommandFlags>,
  ) => Promise<void>;
  dismissProjectError: () => void;

  loadExecutions: () => Promise<void>;
  applyExecution: (execution: Execution) => void;
  applyMetrics: (samples: MetricsSample[]) => void;
  startCommand: (
    projectId: number,
    commandId: string,
    args?: string[] | null,
  ) => Promise<void>;
  stopExecution: (executionId: number) => Promise<void>;
  restartExecution: (executionId: number) => Promise<void>;
  clearFinished: () => Promise<void>;

  setCursor: (key: string | null) => void;
  moveCursor: (delta: number) => void;
  stepCursor: (direction: "in" | "out") => void;
  activateCursor: () => void;

  applyLogs: (executionId: number, lines: LogLine[]) => void;
  loadLogs: (executionId: number) => Promise<void>;
  toggleLogs: (key: string, executionId: number | null) => void;
  closeLogs: () => void;
  openUrl: (executionId: number, portId: string) => Promise<void>;

  loadEditors: () => Promise<void>;
  openProjectIn: (projectId: number, editorId: string | null) => Promise<void>;
  loadDataStatus: () => Promise<void>;
  exportProjects: () => Promise<void>;
  importProjects: () => Promise<void>;
  revealDataFolder: () => Promise<void>;
  makeDiagnosticBundle: () => Promise<void>;
  loadEnvironment: (projectId: number) => Promise<void>;
  saveLog: (executionId: number, label: string) => Promise<void>;
  loadHistory: (projectId: number) => Promise<void>;
  toggleHistoryLog: (executionId: number) => Promise<void>;
  closeHistoryLog: () => void;
  askClearHistory: (asking: boolean) => void;
  clearHistory: () => Promise<void>;

  select: (executionId: number | null) => void;
  selectProject: (projectId: number | null) => void;
  setCommandFilter: (filter: CommandFilter) => void;
  setLogFilter: (filter: LogFilter) => void;
  setLogAutoscroll: (value: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  askStop: (executionId: number | null) => void;
  setArgsFor: (key: string | null) => void;
  note: (text: string) => void;
  dismissNotice: () => void;
  markFailuresSeen: () => void;
};

export type HistoryLog = {
  id: number;
  lines: LogLine[];
};

export type AppStore = StoreState & StoreActions;
