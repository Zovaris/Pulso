export type ThemePref = "dark" | "light" | "system";
export type Locale = "es" | "en";
export type Surface = "popover" | "app";

export type Preferences = {
  theme: ThemePref;
  transparency: boolean;
  locale: Locale;
};

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

export type CommandScan = {
  projectId: number;
  commands: DetectedCommand[];
  status: ScanStatus;

  detail: string | null;
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
