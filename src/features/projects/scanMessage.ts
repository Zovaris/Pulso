import type { CommandScan } from "@/lib/types";

export type ScanMessage = {
  key: string;

  detail?: string;
  hint?: string;
};

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
