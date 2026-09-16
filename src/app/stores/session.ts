import type { StateCreator } from "zustand";
import {
  applyDocumentAppearance,
  applyWindowChrome,
  readStoredTheme,
  readStoredTransparency,
  resolveTheme,
  saveAppearance,
} from "@/lib/appearance";
import {
  applyDocumentLocale,
  detectLocale,
  readStoredLocale,
  translate,
} from "@/lib/i18n";
import type { Surface } from "@/lib/types";
import type { AppStore } from "./types";

export type SessionSlice = Pick<
  AppStore,
  | "surface"
  | "locale"
  | "themePref"
  | "transparency"
  | "setLocale"
  | "setThemePref"
  | "setTransparency"
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

/** Preferencias de sesión y apariencia. Es el estado que no viene del backend. */
export const createSessionSlice: StateCreator<
  AppStore,
  [],
  [],
  SessionSlice
> = (set, get) => ({
  surface: initialSurface,
  locale: initialLocale,
  themePref: initialTheme,
  transparency: initialGlass,
  setLocale: (locale) => {
    applyDocumentLocale(locale);
    set({ locale });
  },
  setThemePref: (pref) => {
    const resolved = resolveTheme(pref);
    const glass = get().transparency;
    applyDocumentAppearance(pref, resolved, glass);
    void applyWindowChrome(resolved, glass);
    void saveAppearance(pref, glass);
    set({ themePref: pref });
  },
  setTransparency: (value) => {
    const pref = get().themePref;
    const resolved = resolveTheme(pref);
    applyDocumentAppearance(pref, resolved, value);
    void applyWindowChrome(resolved, value);
    void saveAppearance(pref, value);
    set({ transparency: value });
  },
  t: (key, vars) => translate(get().locale, key, vars),
});
