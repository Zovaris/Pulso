import { Select, Toggle } from "@zovaris/sephiro";
import { useEffect } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { AppPicker } from "@/features/shell/components/AppPicker";
import type { Locale, ThemePref } from "@/lib/types";
import { LOG_LINE_CHOICES } from "@/lib/types";

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="text-[10.5px] font-medium tracking-[0.03em] text-faint uppercase">
        {title}
      </h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}

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
    <div className="flex items-center gap-4 border-b border-hairline py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[12.5px]">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-faint">{hint}</p> : null}
      </div>
      <div className="ml-auto flex flex-none items-center gap-2">{control}</div>
    </div>
  );
}

function Action({
  label,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-[28px] rounded-[7px] px-3 text-[11.5px] transition-colors duration-[120ms] disabled:cursor-default disabled:opacity-40 ${
        primary
          ? "bg-accent text-white hover:bg-accent-hover"
          : "border border-line text-mist hover:bg-hover hover:text-paper"
      }`}
    >
      {label}
    </button>
  );
}

const SHORTCUTS = [
  { key: "shortcutPalette", keys: "⌘K" },
  { key: "shortcutSections", keys: "⌘1…⌘5" },
  { key: "shortcutRescan", keys: "⌘R" },
  { key: "shortcutOpenEditor", keys: "⌘O" },
  { key: "shortcutStop", keys: "⌘." },
  { key: "shortcutCopyLog", keys: "⌘⇧L" },
  { key: "shortcutClosePopover", keys: "Esc" },
];

export function SettingsSection() {
  const { t, locale } = useI18n();
  const themePref = useStore((state) => state.themePref);
  const transparency = useStore((state) => state.transparency);
  const sound = useStore((state) => state.sound);
  const openAtLogin = useStore((state) => state.openAtLogin);
  const keepRunning = useStore((state) => state.keepRunning);
  const confirmStop = useStore((state) => state.confirmStop);
  const notifyOnFailure = useStore((state) => state.notifyOnFailure);
  const logLines = useStore((state) => state.logLines);
  const data = useStore((state) => state.data);
  const working = useStore((state) => state.working);
  const updatePreferences = useStore((state) => state.updatePreferences);
  const loadDataStatus = useStore((state) => state.loadDataStatus);
  const exportProjects = useStore((state) => state.exportProjects);
  const importProjects = useStore((state) => state.importProjects);
  const revealDataFolder = useStore((state) => state.revealDataFolder);
  const makeDiagnosticBundle = useStore((state) => state.makeDiagnosticBundle);
  const clearFinished = useStore((state) => state.clearFinished);

  useEffect(() => {
    void loadDataStatus();
  }, [loadDataStatus]);

  return (
    <div className="pulso-pane flex min-w-0 flex-1 flex-col overflow-auto px-6 py-5">
      <header>
        <h1 className="text-[16px] font-semibold tracking-[-0.015em]">
          {t("sectionSettings")}
        </h1>
        <p className="mt-1 text-[12px] text-mist">{t("settingsLede")}</p>
      </header>

      <div className="mt-5 max-w-[640px]">
        <Group title={t("appearance")}>
          <Row
            label={t("theme")}
            hint={t("themeHint")}
            control={
              <Select
                value={themePref}
                onValueChange={(value) =>
                  updatePreferences({ theme: value as ThemePref })
                }
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
                onValueChange={(value) =>
                  updatePreferences({ locale: value as Locale })
                }
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
                onCheckedChange={(checked) =>
                  updatePreferences({ transparency: checked })
                }
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
                onCheckedChange={(checked) =>
                  updatePreferences({ sound: checked })
                }
                label={t("soundCues")}
                size="sm"
              />
            }
          />
        </Group>

        <Group title={t("behavior")}>
          <Row
            label={t("openAtLogin")}
            hint={t("openAtLoginHint")}
            control={
              <Toggle
                checked={openAtLogin}
                onCheckedChange={(checked) =>
                  updatePreferences({ openAtLogin: checked })
                }
                label={t("openAtLogin")}
                size="sm"
              />
            }
          />
          <Row
            label={t("defaultEditorLabel")}
            hint={t("defaultEditorHint")}
            control={<AppPicker />}
          />
          <Row
            label={t("keepRunning")}
            hint={t("keepRunningHint")}
            control={
              <Toggle
                checked={keepRunning}
                onCheckedChange={(checked) =>
                  updatePreferences({ keepRunning: checked })
                }
                label={t("keepRunning")}
                size="sm"
              />
            }
          />
          <Row
            label={t("confirmStop")}
            hint={t("confirmStopHint")}
            control={
              <Toggle
                checked={confirmStop}
                onCheckedChange={(checked) =>
                  updatePreferences({ confirmStop: checked })
                }
                label={t("confirmStop")}
                size="sm"
              />
            }
          />
          <Row
            label={t("logLinesLabel")}
            hint={t("logLinesHint")}
            control={
              <Select
                value={String(logLines)}
                onValueChange={(value) =>
                  updatePreferences({ logLines: Number(value) })
                }
                options={LOG_LINE_CHOICES.map((lines) => ({
                  value: String(lines),
                  label: lines.toLocaleString(locale),
                }))}
                ariaLabel={t("logLinesLabel")}
                size="sm"
              />
            }
          />
          <Row
            label={t("notifyOnFailure")}
            hint={t("notifyOnFailureHint")}
            control={
              <Toggle
                checked={notifyOnFailure}
                onCheckedChange={(checked) =>
                  updatePreferences({ notifyOnFailure: checked })
                }
                label={t("notifyOnFailure")}
                size="sm"
              />
            }
          />
        </Group>

        <Group title={t("data")}>
          <Row
            label={t("database")}
            hint={data?.database ?? t("readingShort")}
            control={
              <Action
                label={t("reveal")}
                onClick={() => void revealDataFolder()}
              />
            }
          />
          <Row
            label={t("projectsStored")}
            hint={
              data
                ? t("projectsMissing", {
                    count: data.projects,
                    missing: data.missing,
                  })
                : t("readingShort")
            }
            control={
              <>
                <Action
                  label={t("exportProjects")}
                  disabled={working !== null}
                  onClick={() => void exportProjects()}
                />
                <Action
                  label={t("importProjects")}
                  disabled={working !== null}
                  onClick={() => void importProjects()}
                />
              </>
            }
          />
          <Row
            label={t("sessionLog")}
            hint={t("sessionLogHint")}
            control={
              <>
                <Action
                  label={t("clearFinished")}
                  onClick={() => void clearFinished()}
                />
                <Action
                  label={t("makeBundle")}
                  disabled={working !== null}
                  onClick={() => void makeDiagnosticBundle()}
                />
              </>
            }
          />
        </Group>

        <Group title={t("shortcuts")}>
          <div className="flex flex-col gap-1.5 py-2">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-baseline justify-between gap-4 text-[12px]"
              >
                <span className="text-mist">{t(shortcut.key)}</span>
                <kbd className="rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-faint">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </Group>
      </div>
    </div>
  );
}
