import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { Preferences } from "@/lib/types";

export function getPreferences(): Promise<Preferences | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("get_preferences");
}

export function persistPreferences(
  preferences: Preferences,
): Promise<Preferences | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("save_preferences", { preferences });
}
