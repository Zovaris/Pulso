import { invoke } from "@tauri-apps/api/core";

export function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function quitSoffy(): Promise<void> {
  if (!isTauri()) {
    window.close();
    return Promise.resolve();
  }
  return invoke("quit_soffy");
}

export function openMainWindow(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("open_main_window");
}

export function hidePopover(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("hide_popover");
}
