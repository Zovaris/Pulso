import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { EditorTarget } from "@/lib/types";

export function listEditors(): Promise<EditorTarget[]> {
  if (!isTauri()) return Promise.resolve([]);
  return invoke("list_editors");
}

/** The app's own icon as the system draws it, ready for an `<img src>`. */
export function appIcon(editorId: string): Promise<string | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("app_icon", { editorId });
}

/** Opens the project, or reveals it in Finder when asked for `finder`. */
export function openProject(
  projectId: number,
  editorId: string | null,
): Promise<string | null> {
  if (!isTauri()) return Promise.resolve(null);
  return invoke("open_project", { projectId, editorId });
}
