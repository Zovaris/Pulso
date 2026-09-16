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
import type { Surface } from "@/lib/types";
import { getAppearance, persistAppearance } from "@/services/api/settings";
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
  | "hydrateAppearance"
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
    void persistAppearance({ theme: pref, transparency: glass }).catch(
      () => undefined,
    );
    set({ themePref: pref });
  },
  setTransparency: (value) => {
    const pref = get().themePref;
    const resolved = resolveTheme(pref);
    applyDocumentAppearance(pref, resolved, value);
    void applyWindowChrome(resolved, value);
    void persistAppearance({ theme: pref, transparency: value }).catch(
      () => undefined,
    );
    set({ transparency: value });
  },
  // The `localStorage` copy already painted the first frame; this reconciles it
  // with the record in Rust, and seeds that record on a first run.
  hydrateAppearance: async () => {
    const stored = await getAppearance().catch(() => null);
    if (!stored) {
      await persistAppearance({
        theme: get().themePref,
        transparency: get().transparency,
      }).catch(() => undefined);
      return;
    }
    if (
      stored.theme === get().themePref &&
      stored.transparency === get().transparency
    ) {
      return;
    }

    const resolved = resolveTheme(stored.theme);
    applyDocumentAppearance(stored.theme, resolved, stored.transparency);
    void applyWindowChrome(resolved, stored.transparency);
    set({ themePref: stored.theme, transparency: stored.transparency });
  },
  t: (key, vars) => translate(get().locale, key, vars),
});
