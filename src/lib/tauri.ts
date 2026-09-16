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

/**
 * The native folder panel takes focus, so the popover asks to come back.
 * Uses the window API directly: `core:window:allow-show` and
 * `allow-set-focus` are already granted, so no custom command is needed.
 */
export async function showPopover(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.show();
    await win.setFocus();
  } catch {}
}

export async function pickProjectFolder(title: string): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false, title });

  return typeof selected === "string" ? selected : null;
}
