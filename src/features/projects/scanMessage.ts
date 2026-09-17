import type { CommandScan } from "@/lib/types";

export type ScanMessage = {
  key: string;

  detail?: string;
};

export function scanMessage(scan: CommandScan): ScanMessage | null {
  const detail = scan.detail ?? undefined;

  switch (scan.status) {
    case "detected":
      return null;
    case "noManifest":
      return { key: "noManifest", detail };
    case "noCommands":
      return { key: "noCommands", detail };
    case "invalidManifest":
      return { key: "manifestBroken", detail };
    case "unreadable":
      return { key: "manifestUnreadable", detail };
    case "unavailable":
      return { key: "projectMissing" };
  }
}
