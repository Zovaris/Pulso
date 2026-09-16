export type ThemePref = "dark" | "light" | "system";
export type Locale = "es" | "en";
export type Surface = "popover" | "app";

export type Appearance = {
  theme: ThemePref;
  transparency: boolean;
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
