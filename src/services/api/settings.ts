import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { Appearance } from "@/lib/types";

/**
 * The record lives in Rust. `null` means nothing has been chosen yet, and the
 * caller then writes what it booted with.
 */
export function getAppearance(): Promise<Appearance | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("get_appearance");
}

export function persistAppearance(appearance: Appearance): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("save_appearance", {
    theme: appearance.theme,
    transparency: appearance.transparency,
  });
}
