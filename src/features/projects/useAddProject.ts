import { useCallback } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { pickProjectFolder } from "@/lib/tauri";

/**
 * Opens the native folder panel and hands the result to the store, which is
 * where the backend call and its errors live. Never throws: a cancelled panel
 * resolves to `false`.
 */
export function useAddProject(): () => Promise<boolean> {
  const { t } = useI18n();
  const addProject = useStore((state) => state.addProject);

  return useCallback(async () => {
    const path = await pickProjectFolder(t("addProject")).catch(() => null);
    if (!path) return false;

    return (await addProject(path)) !== null;
  }, [addProject, t]);
}
