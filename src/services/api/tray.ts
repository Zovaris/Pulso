import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";

export function setTrayBadge(png: number[] | null): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("set_tray_badge", { png });
}
