import { FolderSimplePlus } from "@phosphor-icons/react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import type { Locale, ThemePref } from "@/lib/types";

export function AppShell() {
  const { t, locale, setLocale } = useI18n();
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
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-mist hover:bg-hover"
          >
            <FolderSimplePlus size={15} />
            {t("addProject")}
          </button>
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
                <label className="flex items-center justify-between gap-4 text-[13px]">
                  <span>{t("theme")}</span>
                  <select
                    value={themePref}
                    onChange={(e) => setThemePref(e.target.value as ThemePref)}
                    className="rounded-lg border border-line bg-raised px-2 py-1 text-[12.5px]"
                  >
                    <option value="system">{t("themeSystem")}</option>
                    <option value="dark">{t("themeDark")}</option>
                    <option value="light">{t("themeLight")}</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-4 text-[13px]">
                  <span>{t("language")}</span>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as Locale)}
                    className="rounded-lg border border-line bg-raised px-2 py-1 text-[12.5px]"
                  >
                    <option value="en">English</option>
                    <option value="es">Espanol</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-4 text-[13px]">
                  <span>{t("transparency")}</span>
                  <input
                    type="checkbox"
                    checked={transparency}
                    onChange={(e) => setTransparency(e.target.checked)}
                  />
                </label>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
