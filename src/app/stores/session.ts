import type { StateCreator } from "zustand";
import {
  applyDocumentAppearance,
  applyWindowChrome,
  readStoredPalette,
  readStoredTheme,
  readStoredTransparency,
  resolveTheme,
} from "@/lib/appearance";
import {
  applyDocumentLocale,
  detectLocale,
  readStoredLocale,
  translate,
} from "@/lib/i18n";
import type {
  Locale,
  Palette,
  Preferences,
  Surface,
  ThemePref,
} from "@/lib/types";
import { LOG_LINE_CHOICES } from "@/lib/types";
import { toBackendError } from "@/services/api/errors";
import { getPreferences, persistPreferences } from "@/services/api/settings";
import { transitionView } from "@/lib/motion";
import type { AppStore } from "./types";

export type SessionSlice = Pick<
  AppStore,
  | "surface"
  | "section"
  | "setSection"
  | "locale"
  | "themePref"
  | "palette"
  | "transparency"
  | "sound"
  | "editor"
  | "openAtLogin"
  | "keepRunning"
  | "confirmStop"
  | "notifyOnFailure"
  | "notifyOnDone"
  | "notifyOnReady"
  | "logLines"
  | "setLocale"
  | "setThemePref"
  | "setPalette"
  | "setTransparency"
  | "setSound"
  | "updatePreferences"
  | "applyPreferences"
  | "hydratePreferences"
  | "t"
>;

function currentSurface(): Surface {
  try {
    const internals = window as unknown as {
      __TAURI_INTERNALS__?: {
        metadata?: { currentWindow?: { label?: string } };
      };
    };
    const label = internals.__TAURI_INTERNALS__?.metadata?.currentWindow?.label;
    if (label === "popover") return "popover";
    const params = new URLSearchParams(window.location.search);
    if (params.get("surface") === "popover") return "popover";
  } catch {}
  return "app";
}

const initialLocale = readStoredLocale() ?? detectLocale();
const initialTheme = readStoredTheme();
const initialPalette = readStoredPalette();
const initialGlass = readStoredTransparency();
const initialSurface = currentSurface();
document.documentElement.dataset.surface = initialSurface;

export const DEFAULT_LOG_LINES = 4000;

export function sanitizeLogLines(lines: number): number {
  return LOG_LINE_CHOICES.includes(lines as (typeof LOG_LINE_CHOICES)[number])
    ? lines
    : DEFAULT_LOG_LINES;
}

export const createSessionSlice: StateCreator<
  AppStore,
  [],
  [],
  SessionSlice
> = (set, get) => {
  let saving = Promise.resolve();
  let pending = 0;
  let changed = 0;
  let hydrated: Promise<void> | undefined;
  let confirmed: Preferences | undefined;

  const persist = (preferences: Preferences) => {
    pending += 1;
    const request = changed;
    saving = saving.then(async () => {
      try {
        const stored = await persistPreferences(preferences);
        confirmed = stored ?? preferences;
        if (request === changed) apply(confirmed);
      } catch (cause) {
        if (request === changed && confirmed) apply(confirmed);
        set({ projectError: toBackendError(cause) });
      } finally {
        pending -= 1;
        if (pending === 0) {
          try {
            const latest = await getPreferences();
            if (latest && pending === 0 && request === changed) {
              confirmed = latest;
              apply(latest);
            }
          } catch (cause) {
            set({ projectError: toBackendError(cause) });
          }
        }
      }
    });
    return saving;
  };

  const chosen = (): Preferences => {
    const state = get();
    return {
      theme: state.themePref,
      palette: state.palette,
      transparency: state.transparency,
      locale: state.locale,
      sound: state.sound,
      editor: state.editor,
      openAtLogin: state.openAtLogin,
      keepRunning: state.keepRunning,
      confirmStop: state.confirmStop,
      notifyOnFailure: state.notifyOnFailure,
      notifyOnDone: state.notifyOnDone,
      notifyOnReady: state.notifyOnReady,
      logLines: state.logLines,
    };
  };

  const apply = (preferences: Preferences) => {
    const resolved = resolveTheme(preferences.theme);
    applyDocumentAppearance(
      preferences.theme,
      resolved,
      preferences.transparency,
      preferences.palette,
    );
    applyDocumentLocale(preferences.locale);
    void applyWindowChrome(
      preferences.theme,
      resolved,
      preferences.transparency,
    );
    set({
      themePref: preferences.theme,
      palette: preferences.palette,
      transparency: preferences.transparency,
      locale: preferences.locale,
      sound: preferences.sound,
      editor: preferences.editor,
      openAtLogin: preferences.openAtLogin,
      keepRunning: preferences.keepRunning,
      confirmStop: preferences.confirmStop,
      notifyOnFailure: preferences.notifyOnFailure,
      notifyOnDone: preferences.notifyOnDone ?? true,
      notifyOnReady: preferences.notifyOnReady ?? true,
      logLines: sanitizeLogLines(preferences.logLines),
      ...(sanitizeLogLines(preferences.logLines) < get().logLines
        ? {
            logs: Object.fromEntries(
              Object.entries(get().logs ?? {}).map(([id, lines]) => [
                id,
                lines.slice(-sanitizeLogLines(preferences.logLines)),
              ]),
            ),
          }
        : {}),
    });
  };

  return {
    surface: initialSurface,
    locale: initialLocale,
    themePref: initialTheme,
    palette: initialPalette,
    transparency: initialGlass,
    sound: true,
    editor: null,
    openAtLogin: false,
    keepRunning: true,
    confirmStop: false,
    notifyOnFailure: true,
    notifyOnDone: true,
    notifyOnReady: true,
    logLines: DEFAULT_LOG_LINES,
    section: "overview",

    // Opening Procesos is the moment the user is looking at what failed, so the
    // sidebar marker clears right there instead of needing its own effect.
    setSection: (section) => {
      const apply = () => {
        set({ section });
        if (section === "processes") get().markFailuresSeen();
      };
      if (get().section === section) apply();
      else transitionView(apply);
    },

    updatePreferences: (patch) => {
      confirmed ??= chosen();
      changed += 1;
      const next = { ...chosen(), ...patch };
      apply(next);
      void persist(next);
    },

    setLocale: (locale: Locale) => get().updatePreferences({ locale }),

    setThemePref: (pref: ThemePref) => get().updatePreferences({ theme: pref }),

    setPalette: (palette: Palette) => get().updatePreferences({ palette }),

    setTransparency: (value: boolean) =>
      get().updatePreferences({ transparency: value }),

    setSound: (value: boolean) => get().updatePreferences({ sound: value }),

    applyPreferences: (preferences) => {
      if (pending > 0) return;
      confirmed = preferences;
      apply(preferences);
    },

    hydratePreferences: () => {
      hydrated ??= (async () => {
        const request = changed;
        try {
          const stored = await getPreferences();
          if (request !== changed) return;
          if (!stored) {
            confirmed = chosen();
            await persist(confirmed);
          } else {
            confirmed = stored;
            apply(stored);
          }
        } catch (cause) {
          set({ projectError: toBackendError(cause) });
        }
      })();
      return hydrated;
    },

    t: (key, vars) => translate(get().locale, key, vars),
  };
};
