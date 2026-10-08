import type { Palette, ThemePref } from "./types";
import { PALETTE_CHOICES } from "./types";

export type ResolvedTheme = "dark" | "light";

const THEME_KEY = "pulso:theme";
const PALETTE_KEY = "pulso:palette";
const GLASS_KEY = "pulso:transparency";
/** Matches `.pulso-menu`, so the material and the drawn rim share one corner. */
const POPOVER_RADIUS = 10;

export function readStoredTheme(): ThemePref {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "system" || value === "dark")
      return value;
  } catch {}
  return "system";
}

export function readStoredPalette(): Palette {
  try {
    const value = window.localStorage.getItem(PALETTE_KEY);
    if (value !== null && isPalette(value)) return value;
  } catch {}
  return "pulso";
}

function isPalette(value: string): value is Palette {
  return PALETTE_CHOICES.includes(value as Palette);
}

export function readStoredTransparency(): boolean {
  try {
    return window.localStorage.getItem(GLASS_KEY) === "1";
  } catch {
    return false;
  }
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

export function applyDocumentAppearance(
  pref: ThemePref,
  resolved: ResolvedTheme,
  transparency: boolean,
  palette: Palette,
) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePref = pref;
  root.dataset.sephiroTheme = palette;
  root.dataset.transparency = transparency ? "on" : "off";
  root.style.colorScheme = resolved;
  try {
    window.localStorage.setItem(THEME_KEY, pref);
    window.localStorage.setItem(PALETTE_KEY, palette);
    window.localStorage.setItem(GLASS_KEY, transparency ? "1" : "0");
  } catch {}
}

export async function applyWindowChrome(
  pref: ThemePref,
  resolved: ResolvedTheme,
  transparency: boolean,
) {
  try {
    const { Effect, EffectState, getCurrentWindow } =
      await import("@tauri-apps/api/window");
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    const win = getCurrentWindow();
    await win.setTheme(pref === "system" ? null : resolved);
    const clearWebviewBackground = () =>
      getCurrentWebview()
        .setBackgroundColor(null)
        .catch(() => undefined);
    const material =
      resolved === "dark"
        ? [Effect.HudWindow]
        : [Effect.HeaderView, Effect.ContentBackground];

    if (win.label === "popover") {
      await clearWebviewBackground();
      await win.setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 });
      await win.setEffects({
        effects: [Effect.Menu],
        state: EffectState.Active,
        radius: POPOVER_RADIUS,
      });
      document.documentElement.dataset.material = "menu";

      return;
    }
    if (transparency) {
      await win.setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 });
      await win.setEffects({
        effects: material,
        state: EffectState.Active,
      });
    } else {
      await win.clearEffects();
      await win.setBackgroundColor(
        getComputedStyle(document.documentElement)
          .getPropertyValue("--sph-bg")
          .trim(),
      );
    }
  } catch {}
}
