import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";

export function setTrayBadge(png: number[] | null): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("set_tray_badge", { png });
}

/** When the user last looked at what failed; `null` outside the app. */
export function failuresSeenAt(): Promise<number | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("failures_seen_at");
}

export function markFailuresSeen(): Promise<number | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("mark_failures_seen");
}
