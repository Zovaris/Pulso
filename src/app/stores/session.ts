import type { StateCreator } from "zustand";
import {
  applyDocumentAppearance,
  applyWindowChrome,
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
import type { Locale, Preferences, Surface, ThemePref } from "@/lib/types";
import { LOG_LINE_CHOICES } from "@/lib/types";
import { getPreferences, persistPreferences } from "@/services/api/settings";
import type { AppStore } from "./types";

export type SessionSlice = Pick<
  AppStore,
  | "surface"
  | "section"
  | "setSection"
  | "locale"
  | "themePref"
  | "transparency"
  | "sound"
  | "editor"
  | "openAtLogin"
  | "keepRunning"
  | "confirmStop"
  | "notifyOnFailure"
  | "logLines"
  | "setLocale"
  | "setThemePref"
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
  const persist = (preferences: Preferences) => {
    void persistPreferences(preferences).catch(() => undefined);
  };

  const chosen = (): Preferences => {
    const state = get();
    return {
      theme: state.themePref,
      transparency: state.transparency,
      locale: state.locale,
      sound: state.sound,
      editor: state.editor,
      openAtLogin: state.openAtLogin,
      keepRunning: state.keepRunning,
      confirmStop: state.confirmStop,
      notifyOnFailure: state.notifyOnFailure,
      logLines: state.logLines,
    };
  };

  const apply = (preferences: Preferences) => {
    const resolved = resolveTheme(preferences.theme);
    applyDocumentAppearance(
      preferences.theme,
      resolved,
      preferences.transparency,
    );
    applyDocumentLocale(preferences.locale);
    void applyWindowChrome(resolved, preferences.transparency);
    set({
      themePref: preferences.theme,
      transparency: preferences.transparency,
      locale: preferences.locale,
      sound: preferences.sound,
      editor: preferences.editor,
      openAtLogin: preferences.openAtLogin,
      keepRunning: preferences.keepRunning,
      confirmStop: preferences.confirmStop,
      notifyOnFailure: preferences.notifyOnFailure,
      logLines: sanitizeLogLines(preferences.logLines),
    });
  };

  return {
    surface: initialSurface,
    locale: initialLocale,
    themePref: initialTheme,
    transparency: initialGlass,
    sound: true,
    editor: null,
    openAtLogin: false,
    keepRunning: true,
    confirmStop: false,
    notifyOnFailure: true,
    logLines: DEFAULT_LOG_LINES,
    section: "overview",

    // Opening Procesos is the moment the user is looking at what failed, so the
    // sidebar marker clears right there instead of needing its own effect.
    setSection: (section) =>
      set(
        section === "processes"
          ? { section, seenFailuresAt: Date.now() }
          : { section },
      ),

    updatePreferences: (patch) => {
      const next = { ...chosen(), ...patch };
      apply(next);
      persist(next);
    },

    setLocale: (locale: Locale) => get().updatePreferences({ locale }),

    setThemePref: (pref: ThemePref) => get().updatePreferences({ theme: pref }),

    setTransparency: (value: boolean) =>
      get().updatePreferences({ transparency: value }),

    setSound: (value: boolean) => get().updatePreferences({ sound: value }),

    applyPreferences: apply,

    hydratePreferences: async () => {
      const stored = await getPreferences().catch(() => null);
      if (!stored) {
        persist(chosen());
        return;
      }

      const current = chosen();
      if (JSON.stringify(stored) === JSON.stringify(current)) return;

      apply(stored);
    },

    t: (key, vars) => translate(get().locale, key, vars),
  };
};
