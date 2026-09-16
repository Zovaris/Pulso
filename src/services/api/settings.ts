import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { Preferences } from "@/lib/types";

export function getPreferences(): Promise<Preferences | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("get_preferences");
}

export function persistPreferences(preferences: Preferences): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("save_preferences", {
    theme: preferences.theme,
    transparency: preferences.transparency,
    locale: preferences.locale,
  });
}
