import { Select, Toggle } from "@zovaris/sephiro";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import type { Locale, ThemePref } from "@/lib/types";

function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-hairline py-3">
      <div>
        <p className="text-[13px]">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-[11.5px] text-faint">{hint}</p>
        ) : null}
      </div>
      <div className="ml-auto flex flex-none items-center gap-2">{control}</div>
    </div>
  );
}

export function SettingsSection() {
  const { t, locale, setLocale } = useI18n();
  const themePref = useStore((state) => state.themePref);
  const setThemePref = useStore((state) => state.setThemePref);
  const transparency = useStore((state) => state.transparency);
  const setTransparency = useStore((state) => state.setTransparency);
  const sound = useStore((state) => state.sound);
  const setSound = useStore((state) => state.setSound);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none border-b border-hairline px-9 py-4">
        <h1 className="text-[17px] font-semibold tracking-[-0.015em]">
          {t("sectionSettings")}
        </h1>
        <p className="mt-1 text-[12.5px] text-mist">{t("settingsLede")}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-9 py-7">
        <div className="max-w-[620px]">
          <h2 className="text-[11px] font-medium tracking-[0.02em] text-faint uppercase">
            {t("appearance")}
          </h2>

          <Row
            label={t("theme")}
            hint={t("themeHint")}
            control={
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
            }
          />
          <Row
            label={t("language")}
            hint={t("languageHint")}
            control={
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
            }
          />
          <Row
            label={t("transparency")}
            hint={t("transparencyHint")}
            control={
              <Toggle
                checked={transparency}
                onCheckedChange={setTransparency}
                label={t("transparency")}
                size="sm"
              />
            }
          />
          <Row
            label={t("soundCues")}
            hint={t("soundCuesHint")}
            control={
              <Toggle
                checked={sound}
                onCheckedChange={setSound}
                label={t("soundCues")}
                size="sm"
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
