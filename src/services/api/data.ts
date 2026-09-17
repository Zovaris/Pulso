import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { DataStatus } from "@/lib/types";

export function dataStatus(): Promise<DataStatus> {
  if (!isTauri()) {
    return Promise.resolve({
      folder: "",
      database: "",
      projects: 0,
      missing: 0,
    });
  }
  return invoke("data_status");
}

export function revealDataFolder(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("reveal_data_folder");
}

/** `null` means the user cancelled the save dialog. */
export function exportProjects(): Promise<string | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("export_projects");
}

export function importProjects(): Promise<number | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("import_projects");
}

export function diagnosticBundle(): Promise<string | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("diagnostic_bundle");
}
