import { create } from "zustand";
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
  type TplVars,
  translate,
} from "@/lib/i18n";
import type { Locale, Surface, ThemePref } from "@/lib/types";

function currentSurface(): Surface {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("surface") === "popover" ? "popover" : "app";
  } catch {
    return "app";
  }
}

type AppState = {
  surface: Surface;
  locale: Locale;
  themePref: ThemePref;
  transparency: boolean;
  setLocale: (locale: Locale) => void;
  setThemePref: (pref: ThemePref) => void;
  setTransparency: (value: boolean) => void;
  t: (key: string, vars?: TplVars) => string;
};

const initialLocale = readStoredLocale() ?? detectLocale();
const initialTheme = readStoredTheme();
const initialGlass = readStoredTransparency();

export const useStore = create<AppState>((set, get) => ({
  surface: currentSurface(),
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
}));
