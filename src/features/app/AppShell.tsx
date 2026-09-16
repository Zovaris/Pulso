import { FolderSimplePlus } from "@phosphor-icons/react";
import { Select, Toggle } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ActionRow } from "@/components/shared/ActionRow";
import { useAddProject } from "@/features/projects/useAddProject";
import type { Locale, ThemePref } from "@/lib/types";

export function AppShell() {
  const { t, locale, setLocale } = useI18n();
  const addProject = useAddProject();
  const themePref = useStore((s) => s.themePref);
  const setThemePref = useStore((s) => s.setThemePref);
  const transparency = useStore((s) => s.transparency);
  const setTransparency = useStore((s) => s.setTransparency);

  return (
    <div className="flex h-full flex-col bg-void text-paper">
      <header
        data-tauri-drag-region
        className="flex h-12 items-center justify-center border-b border-line"
      >
        <p className="text-[13px] font-semibold tracking-tight">
          {t("appName")}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
        <aside className="flex flex-col border-r border-line px-3 py-4">
          <p className="mb-3 px-1 text-[11px] font-medium text-faint">
            {t("projects")}
          </p>
          <ActionRow
            icon={<FolderSimplePlus size={15} />}
            label={t("addProject")}
            onClick={() => {
              void addProject();
            }}
          />
        </aside>

        <main className="overflow-auto px-8 py-8">
          <div className="mx-auto max-w-lg">
            <h1 className="text-[22px] font-semibold tracking-tight">
              {t("projects")}
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-mist">
              {t("emptyProjects")}
            </p>
            <p className="mt-1 text-[12.5px] text-faint">{t("comingSoon")}</p>

            <section className="mt-10">
              <h2 className="text-[13px] font-medium">{t("appearance")}</h2>
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <span>{t("theme")}</span>
                  <Select
                    value={themePref}
                    onValueChange={(value) => setThemePref(value as ThemePref)}
                    options={[
                      { value: "system", label: t("themeSystem") },
                      { value: "dark", label: t("themeDark") },
                      { value: "light", label: t("themeLight") },
                    ]}
                    ariaLabel={t("theme")}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <span>{t("language")}</span>
                  <Select
                    value={locale}
                    onValueChange={(value) => setLocale(value as Locale)}
                    options={[
                      { value: "en", label: "English" },
                      { value: "es", label: "Espanol" },
                    ]}
                    ariaLabel={t("language")}
                    size="sm"
                  />
                </div>
                <Toggle
                  checked={transparency}
                  onCheckedChange={setTransparency}
                  label={t("transparency")}
                  size="sm"
                />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
