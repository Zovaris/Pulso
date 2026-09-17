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
  | "setLocale"
  | "setThemePref"
  | "setTransparency"
  | "setSound"
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
    });
  };

  return {
    surface: initialSurface,
    locale: initialLocale,
    themePref: initialTheme,
    transparency: initialGlass,
    sound: true,
    section: "overview",

    setSection: (section) => set({ section }),

    setLocale: (locale: Locale) => {
      const next = { ...chosen(), locale };
      apply(next);
      persist(next);
    },

    setThemePref: (pref: ThemePref) => {
      const next = { ...chosen(), theme: pref };
      apply(next);
      persist(next);
    },

    setTransparency: (value: boolean) => {
      const next = { ...chosen(), transparency: value };
      apply(next);
      persist(next);
    },

    setSound: (value: boolean) => {
      const next = { ...chosen(), sound: value };
      apply(next);
      persist(next);
    },

    applyPreferences: apply,

    hydratePreferences: async () => {
      const stored = await getPreferences().catch(() => null);
      if (!stored) {
        persist(chosen());
        return;
      }

      const current = chosen();
      if (
        stored.theme === current.theme &&
        stored.transparency === current.transparency &&
        stored.locale === current.locale &&
        stored.sound === current.sound
      ) {
        return;
      }

      apply(stored);
    },

    t: (key, vars) => translate(get().locale, key, vars),
  };
};
