import type { LogFilter } from "@/features/desktop/logs";
import type { TplVars } from "@/lib/i18n";
import type {
  BackendError,
  CommandFlags,
  CommandScan,
  CommandGroup,
  CustomCommand,
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
  | "settings"
  | "commands"
  | "ports";

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
  customCommands: CustomCommand[];
  commandGroups: CommandGroup[];

  scans: Record<string, CommandScan>;
  scanningProjectId: number | null;
  rescanning: boolean;

  projectError: BackendError | null;

  executions: Execution[];
  pendingCommandId: string | null;
  metrics: Record<number, MetricsSample>;
  histories: Record<number, number[]>;

  logs: Record<number, LogLine[]>;

  editors: EditorTarget[];
  icons: Record<string, string>;
  selectedExecutionId: number | null;
  selectedProjectId: number | null;
  logFilter: LogFilter;
  logAutoscroll: boolean;
  paletteOpen: boolean;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
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

  loadCustomCommands: () => Promise<void>;
  applyCustomCommands: (commands: CustomCommand[]) => void;
  saveCustomCommand: (command: CustomCommand) => Promise<boolean>;
  deleteCustomCommand: (id: number) => Promise<boolean>;
  loadCommandGroups: () => Promise<void>;
  applyCommandGroups: (groups: CommandGroup[]) => void;
  saveCommandGroup: (group: CommandGroup) => Promise<boolean>;
  deleteCommandGroup: (id: number) => Promise<boolean>;
  startGroup: (group: CommandGroup) => Promise<void>;
  stopGroup: (group: CommandGroup) => Promise<void>;
  loadProjects: () => Promise<void>;
  addProject: (path: string) => Promise<Project | null>;
  removeProject: (projectId: number) => Promise<void>;
  loadCommands: (projectId: number) => Promise<void>;
  rescanProjects: () => Promise<void>;
  rescanProject: (projectId: number) => Promise<void>;

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
  removeExecutions: (ids: number[]) => void;
  applyMetrics: (samples: MetricsSample[]) => void;
  startCommand: (
    projectId: number,
    commandId: string,
    args?: string[] | null,
  ) => Promise<void>;
  stopExecution: (executionId: number) => Promise<void>;
  restartExecution: (executionId: number) => Promise<void>;
  clearFinished: () => Promise<void>;

  applyLogs: (executionId: number, lines: LogLine[]) => void;
  loadLogs: (executionId: number) => Promise<void>;
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
  setLogFilter: (filter: LogFilter) => void;
  setLogAutoscroll: (value: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
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
