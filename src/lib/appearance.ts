import type { ThemePref } from "./types";

export type ResolvedTheme = "dark" | "light";

const THEME_KEY = "pulso:theme";
const GLASS_KEY = "pulso:transparency";

export function readStoredTheme(): ThemePref {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "system" || value === "dark")
      return value;
  } catch {}
  return "system";
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
) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePref = pref;
  root.dataset.transparency = transparency ? "on" : "off";
  root.style.colorScheme = resolved;
  try {
    window.localStorage.setItem(THEME_KEY, pref);
    window.localStorage.setItem(GLASS_KEY, transparency ? "1" : "0");
  } catch {}
}

export async function applyWindowChrome(
  resolved: ResolvedTheme,
  transparency: boolean,
) {
  try {
    const { Effect, EffectState, getCurrentWindow } = await import(
      "@tauri-apps/api/window"
    );
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    const win = getCurrentWindow();
    await win.setTheme(resolved);
    const clearWebviewBackground = () =>
      getCurrentWebview()
        .setBackgroundColor(null)
        .catch(() => undefined);
    if (win.label === "popover") {
      await clearWebviewBackground();
      await win.setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 });
      await win.clearEffects();
      return;
    }
    if (transparency) {
      await win.setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 });
      await win.setEffects({
        effects:
          resolved === "dark"
            ? [Effect.HudWindow]
            : [Effect.HeaderView, Effect.ContentBackground],
        state: EffectState.Active,
      });
    } else {
      await win.clearEffects();
      await win.setBackgroundColor(
        resolved === "dark"
          ? { red: 17, green: 17, blue: 17, alpha: 255 }
          : { red: 243, green: 243, blue: 243, alpha: 255 },
      );
    }
  } catch {}
}
