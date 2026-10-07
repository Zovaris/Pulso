export type ThemePref = "dark" | "light" | "system";

export type Palette = "pulso" | "nord" | "rose-pine" | "catppuccin";

export const PALETTE_CHOICES = [
  "pulso",
  "nord",
  "rose-pine",
  "catppuccin",
] as const satisfies readonly Palette[];

export type Locale = "es" | "en";
export type Surface = "popover" | "app";

export type Preferences = {
  theme: ThemePref;
  palette: Palette;
  transparency: boolean;
  locale: Locale;
  sound: boolean;
  /** The editor `⌘O` opens, or null for whichever one Pulso found first. */
  editor: string | null;
  openAtLogin: boolean;
  keepRunning: boolean;
  confirmStop: boolean;
  notifyOnFailure: boolean;
  notifyOnDone: boolean;
  notifyOnReady: boolean;
  logLines: number;
};

/** The log caps Ajustes offers, and the only values the backend accepts. */
export const LOG_LINE_CHOICES = [500, 1000, 2000, 4000, 10000] as const;

export type Availability = "available" | "missing";

export type Project = {
  id: number;
  name: string;
  path: string;
  availability: Availability;
};

export type CommandCategory =
  | "dev"
  | "build"
  | "test"
  | "lint"
  | "database"
  | "infrastructure"
  | "other";

export type DetectedCommand = {
  id: string;
  label: string;
  program: string;
  args: string[];
  cwd: string;
  source: string;
  detector: string;
  category: CommandCategory;
  longRunning: boolean;
};

export type ScanStatus =
  | "detected"
  | "noManifest"
  | "noCommands"
  | "invalidManifest"
  | "unreadable"
  | "unavailable";

/** What the user decided about a command. Shared with the menubar. */
export type CommandFlags = {
  favorite: boolean;
  hidden: boolean;
};

export const NO_FLAGS: CommandFlags = { favorite: false, hidden: false };

export type CommandScan = {
  projectId: number;
  commands: DetectedCommand[];
  status: ScanStatus;
  detail: string | null;
  flags: Record<string, CommandFlags>;
};

export type ExecutionState =
  | "starting"
  | "running"
  | "stopping"
  | "exited"
  | "failed"
  | "interrupted";

export type LogStream = "stdout" | "stderr";

export type LogLine = {
  seq: number;
  at: number;
  stream: LogStream;
  text: string;
};

export type LogSnapshot = {
  executionId: number;
  lines: LogLine[];
};

export type PortTarget = {
  pid: number;
  port: number;
  address: string;
  startedAt: string | null;
};

/** Verified TCP listener, separate from ports announced in command logs. */
export type ListeningPort = PortTarget & {
  process: string;
  executionId: number | null;
  canStop: boolean;
};

export type DetectedPort = {
  id: string;
  port: number;
  url: string | null;
};

export type Execution = {
  id: number;
  revision?: number;
  projectId: number;
  commandId: string;
  label: string;
  program: string;
  args: string[];
  cwd: string;
  state: ExecutionState;
  pid: number | null;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  /** Why it failed, including the resolved PATH when the program was missing. */
  detail: string | null;
  restartedFrom: number | null;
  ports: DetectedPort[];
};

/** What one live execution costs, pushed every two seconds from Rust. */
export type MetricsSample = {
  executionId: number;
  cpu: number;
  memory: number;
  processes: number;
};

export type EditorTarget = {
  id: string;
  name: string;
  bundleId: string;
  path: string;
};

export type HistoryEntry = {
  id: number;
  projectId: number;
  commandId: string;
  label: string;
  program: string;
  args: string[];
  cwd: string;
  state: ExecutionState;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  detail: string | null;
  /** How many lines of its output survived the session. */
  lines: number;
};

export type DataStatus = {
  folder: string;
  database: string;
  projects: number;
  missing: number;
  runs: number;
};

/** What an import added; what was already in Pulso is not counted. */
export type ImportSummary = {
  projects: number;
  commands: number;
  groups: number;
};

export type PathEntry = {
  dir: string;
  exists: boolean;
};

export type ProgramLookup = {
  name: string;
  path: string | null;
};

export type EnvironmentReport = {
  shell: string;
  path: string;
  entries: PathEntry[];
  programs: ProgramLookup[];
};

export type BackendErrorKind =
  | "notFound"
  | "notADirectory"
  | "unreadable"
  | "invalidInput"
  | "storage"
  | "internal";

export type BackendError = {
  kind: BackendErrorKind;
  message: string;
  path: string | null;
};

export type GroupMember = {
  projectId: number;
  commandId: string;
};

export type CommandGroup = {
  id: number | null;
  label: string;
  members: GroupMember[];
};

export type CustomCommand = {
  id: number | null;
  projectId: number | null;
  label: string;
  command: string;
  cwd: string;
  favorite: boolean;
};
