import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import {
  Button,
  Kbd,
  SegmentedControl,
  Select,
  Toggle,
} from "@zovaris/sephiro";
import { useEffect, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useRootTheme } from "@/app/hooks/useRootTheme";
import { useStore } from "@/app/store";
import { AppPicker } from "@/features/shell/components/AppPicker";
import type { Locale, Palette, ThemePref } from "@/lib/types";
import { LOG_LINE_CHOICES, PALETTE_CHOICES } from "@/lib/types";

const PALETTE_NAMES: Record<Palette, string> = {
  pulso: "Pulso",
  nord: "Nord",
  "rose-pine": "Rosé Pine",
  catppuccin: "Catppuccin",
};

const THEMES = [
  { value: "system", label: "themeSystem", Icon: DesktopIcon },
  { value: "dark", label: "themeDark", Icon: MoonIcon },
  { value: "light", label: "themeLight", Icon: SunIcon },
] as const;

/** One inset group of rows, as in System Settings. */
function Group({ children }: { children: React.ReactNode }) {
  return <section className="pulso-settings-group">{children}</section>;
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
    <div className="pulso-settings-row">
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
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

const SHORTCUTS = [
  { key: "shortcutPalette", keys: "⌘K" },
  { key: "shortcutSections", keys: "⌘1…⌘6" },
  { key: "shortcutSettings", keys: "⌘," },
  { key: "shortcutSidebar", keys: "⌘B" },
  { key: "shortcutRescan", keys: "⌘R" },
  { key: "shortcutOpenEditor", keys: "⌘O" },
  { key: "shortcutStop", keys: "⌘." },
  { key: "shortcutCopyLog", keys: "⌘⇧L" },
  { key: "shortcutClosePopover", keys: "Esc" },
];

type Category = "general" | "appearance" | "run" | "data" | "shortcuts";
const CATEGORIES: { value: Category; labelKey: string }[] = [
  { value: "general", labelKey: "settingsGeneral" },
  { value: "appearance", labelKey: "appearance" },
  { value: "run", labelKey: "settingsRun" },
  { value: "data", labelKey: "data" },
  { value: "shortcuts", labelKey: "shortcuts" },
];

export function SettingsSection() {
  const { t, locale } = useI18n();
  const rootTheme = useRootTheme();
  const themePref = useStore((state) => state.themePref);
  const palette = useStore((state) => state.palette);
  const transparency = useStore((state) => state.transparency);
  const sound = useStore((state) => state.sound);
  const openAtLogin = useStore((state) => state.openAtLogin);
  const keepRunning = useStore((state) => state.keepRunning);
  const confirmStop = useStore((state) => state.confirmStop);
  const notifyOnFailure = useStore((state) => state.notifyOnFailure);
  const notifyOnDone = useStore((state) => state.notifyOnDone);
  const notifyOnReady = useStore((state) => state.notifyOnReady);
  const logLines = useStore((state) => state.logLines);
  const data = useStore((state) => state.data);
  const working = useStore((state) => state.working);
  const updatePreferences = useStore((state) => state.updatePreferences);
  const loadDataStatus = useStore((state) => state.loadDataStatus);
  const exportProjects = useStore((state) => state.exportProjects);
  const importProjects = useStore((state) => state.importProjects);
  const revealDataFolder = useStore((state) => state.revealDataFolder);
  const makeDiagnosticBundle = useStore((state) => state.makeDiagnosticBundle);
  const askClearHistory = useStore((state) => state.askClearHistory);

  const [category, setCategory] = useState<Category>("general");

  useEffect(() => {
    void loadDataStatus();
  }, [loadDataStatus]);

  const toggle = (
    label: string,
    checked: boolean,
    change: (checked: boolean) => void,
  ) => (
    <Toggle
      checked={checked}
      onCheckedChange={change}
      label={label}
      size="sm"
    />
  );

  return (
    <div className="pulso-pane flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex-none px-6 pt-5 pb-4">
        <h1 className="text-[16px] font-semibold tracking-[-0.015em]">
          {t("sectionSettings")}
        </h1>
        <p className="mt-1 text-[12px] text-mist">{t("settingsLede")}</p>
      </header>

      <div className="pulso-filter-bar">
        <SegmentedControl
          size="sm"
          ariaLabel={t("sectionSettings")}
          value={category}
          onValueChange={(value) => setCategory(value as Category)}
          options={CATEGORIES.map((entry) => ({
            value: entry.value,
            label: t(entry.labelKey),
          }))}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        <div className="flex max-w-[640px] flex-col gap-4">
          {category === "general" ? (
            <>
              <Group>
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
                        { value: "es", label: "Español" },
                        { value: "en", label: "English" },
                      ]}
                      ariaLabel={t("language")}
                      size="sm"
                    />
                  }
                />
                <Row
                  label={t("openAtLogin")}
                  hint={t("openAtLoginHint")}
                  control={toggle(t("openAtLogin"), openAtLogin, (checked) =>
                    updatePreferences({ openAtLogin: checked }),
                  )}
                />
              </Group>
              <Group>
                <Row
                  label={t("defaultEditorLabel")}
                  hint={t("defaultEditorHint")}
                  control={<AppPicker />}
                />
                <Row
                  label={t("keepRunning")}
                  hint={t("keepRunningHint")}
                  control={toggle(t("keepRunning"), keepRunning, (checked) =>
                    updatePreferences({ keepRunning: checked }),
                  )}
                />
              </Group>
            </>
          ) : null}

          {category === "appearance" ? (
            <Group>
              <Row
                label={t("themePalette")}
                hint={t("themePaletteHint")}
                control={
                  <SegmentedControl
                    size="sm"
                    ariaLabel={t("themePalette")}
                    value={palette}
                    onValueChange={(value) =>
                      updatePreferences({ palette: value as Palette })
                    }
                    options={PALETTE_CHOICES.map((value) => ({
                      value,
                      label: (
                        <span className="pulso-palette-option">
                          <span
                            className="pulso-palette-swatch"
                            data-sephiro-theme={value}
                            data-theme={rootTheme}
                          >
                            <i aria-hidden />
                            <i aria-hidden />
                            <i aria-hidden />
                          </span>
                          {PALETTE_NAMES[value]}
                        </span>
                      ),
                    }))}
                  />
                }
              />
              <Row
                label={t("theme")}
                hint={t("themeHint")}
                control={
                  <SegmentedControl
                    size="sm"
                    className="pulso-icon-segments"
                    ariaLabel={t("theme")}
                    value={themePref}
                    onValueChange={(value) =>
                      updatePreferences({ theme: value as ThemePref })
                    }
                    options={THEMES.map(({ value, label, Icon }) => ({
                      value,
                      label: (
                        <span title={t(label)}>
                          <Icon size={15} aria-hidden />
                          <span className="sph-visually-hidden">
                            {t(label)}
                          </span>
                        </span>
                      ),
                    }))}
                  />
                }
              />
              <Row
                label={t("transparency")}
                hint={t("transparencyHint")}
                control={toggle(t("transparency"), transparency, (checked) =>
                  updatePreferences({ transparency: checked }),
                )}
              />
            </Group>
          ) : null}

          {category === "run" ? (
            <>
              <Group>
                <Row
                  label={t("confirmStop")}
                  hint={t("confirmStopHint")}
                  control={toggle(t("confirmStop"), confirmStop, (checked) =>
                    updatePreferences({ confirmStop: checked }),
                  )}
                />
              </Group>
              <Group>
                <Row
                  label={t("notifyOnFailure")}
                  hint={t("notifyOnFailureHint")}
                  control={toggle(
                    t("notifyOnFailure"),
                    notifyOnFailure,
                    (checked) =>
                      updatePreferences({ notifyOnFailure: checked }),
                  )}
                />
                <Row
                  label={t("notifyOnReady")}
                  hint={t("notifyOnReadyHint")}
                  control={toggle(
                    t("notifyOnReady"),
                    notifyOnReady,
                    (checked) => updatePreferences({ notifyOnReady: checked }),
                  )}
                />
                <Row
                  label={t("notifyOnDone")}
                  hint={t("notifyOnDoneHint")}
                  control={toggle(t("notifyOnDone"), notifyOnDone, (checked) =>
                    updatePreferences({ notifyOnDone: checked }),
                  )}
                />
                <Row
                  label={t("soundCues")}
                  hint={t("soundCuesHint")}
                  control={toggle(t("soundCues"), sound, (checked) =>
                    updatePreferences({ sound: checked }),
                  )}
                />
              </Group>
              <Group>
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
              </Group>
            </>
          ) : null}

          {category === "data" ? (
            <>
              <Group>
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
                  control={null}
                />
                <Row
                  label={t("projectsTransfer")}
                  hint={t("projectsTransferHint")}
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
              </Group>
              <Group>
                <Row
                  label={t("sessionLog")}
                  hint={t("sessionLogHint")}
                  control={
                    <Action
                      label={t("makeBundle")}
                      disabled={working !== null}
                      onClick={() => void makeDiagnosticBundle()}
                    />
                  }
                />
                <Row
                  label={t("executionHistory")}
                  hint={
                    data === null
                      ? t("readingShort")
                      : data.runs === 0
                        ? t("executionHistoryEmpty")
                        : t("executionHistoryHint", { count: data.runs })
                  }
                  control={
                    <Action
                      label={t("clearHistory")}
                      disabled={working !== null || (data?.runs ?? 0) === 0}
                      onClick={() => askClearHistory(true)}
                    />
                  }
                />
              </Group>
            </>
          ) : null}

          {category === "shortcuts" ? (
            <Group>
              {SHORTCUTS.map((shortcut) => (
                <Row
                  key={shortcut.key}
                  label={t(shortcut.key)}
                  control={<Kbd keys={shortcut.keys} />}
                />
              ))}
            </Group>
          ) : null}
        </div>
      </div>
    </div>
  );
}
