import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { EnvironmentReport } from "@/lib/types";

export function environmentReport(
  projectId: number,
): Promise<EnvironmentReport | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("environment_report", { projectId });
}
