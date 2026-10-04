import { invoke } from "@tauri-apps/api/core";

export function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function quitPulso(): Promise<void> {
  if (!isTauri()) {
    window.close();
    return Promise.resolve();
  }
  return invoke("quit_pulso");
}

export function openMainWindow(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("open_main_window");
}

export function closePopover(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("close_popover");
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

/** Sizes the popover window to the menu it holds, so the material ends where the menu does. */
export async function fitPopover(width: number, height: number): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow, LogicalSize } =
      await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    if (win.label !== "popover") return;
    await win.setSize(new LogicalSize(Math.ceil(width), Math.ceil(height)));
  } catch {}
}

export function setReducedMotion(value: boolean): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("set_reduced_motion", { value });
}

export async function pickProjectFolder(title: string): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await invoke<string | null>("pick_project_folder", {
    title,
  });

  return selected ?? null;
}
