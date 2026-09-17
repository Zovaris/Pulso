export type ThemePref = "dark" | "light" | "system";
export type Locale = "es" | "en";
export type Surface = "popover" | "app";

export type Preferences = {
  theme: ThemePref;
  transparency: boolean;
  locale: Locale;
  sound: boolean;
  /** The editor `⌘O` opens, or null for whichever one Pulso found first. */
  editor: string | null;
  openAtLogin: boolean;
  keepRunning: boolean;
  confirmStop: boolean;
  notifyOnFailure: boolean;
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
  | "failed";

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

export type DetectedPort = {
  id: string;
  port: number;
  url: string | null;
};

export type Execution = {
  id: number;
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

export type DataStatus = {
  folder: string;
  database: string;
  projects: number;
  missing: number;
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
