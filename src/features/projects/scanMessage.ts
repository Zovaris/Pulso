import type { CommandScan } from "@/lib/types";

export type ScanMessage = {
  key: string;
  /** Shown only when the reason is technical, like a parse failure. */
  detail?: string;
  hint?: string;
};

/**
 * What to say when a scan produced no commands. `null` means there is nothing
 * to explain, because there are commands to show.
 */
export function scanMessage(scan: CommandScan): ScanMessage | null {
  switch (scan.status) {
    case "detected":
      return null;
    case "noManifest":
      return { key: "noManifest", hint: "nodeOnlyHint" };
    case "noCommands":
      return { key: "noCommands" };
    case "invalidManifest":
    case "unreadable":
      return { key: "manifestUnreadable", detail: scan.detail ?? undefined };
    case "unavailable":
      return { key: "projectMissing" };
  }
}
