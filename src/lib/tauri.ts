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
  const selected = await invoke<string | null>("pick_project_folder", {
    title,
  });

  return selected ?? null;
}
