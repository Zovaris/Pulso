export type ThemePref = "dark" | "light" | "system";
export type Locale = "es" | "en";
export type Surface = "popover" | "app";

export type Appearance = {
  theme: ThemePref;
  transparency: boolean;
};

/** Resolved by Rust on every read, because a folder can move between reads. */
export type Availability = "available" | "missing";

export type Project = {
  /** Surrogate key from the database, not the path. */
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
  /** Stable across scans: `<detector>:<label>`. */
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

/**
 * Why a scan produced the commands it did. The UI has copy for every status, so
 * an empty project explains itself instead of showing a blank area.
 */
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
  /** The technical reason. Only worth showing for a broken or unreadable file. */
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
