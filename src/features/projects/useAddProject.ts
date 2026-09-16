import { useCallback } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { pickProjectFolder } from "@/lib/tauri";

/**
 * Opens the native folder panel and adds the chosen project.
 * Never throws: a cancelled or failed panel resolves to `false`.
 */
export function useAddProject(): () => Promise<boolean> {
  const { t } = useI18n();
  const addProject = useStore((state) => state.addProject);

  return useCallback(async () => {
    const path = await pickProjectFolder(t("addProject")).catch(() => null);
    if (!path) return false;

    addProject(path);
    return true;
  }, [addProject, t]);
}
