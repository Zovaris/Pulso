import type { Locale } from "../types";

export const LOCALE_KEY = "soffy:locale";

export const SUPPORTED_LOCALES: readonly Locale[] = ["es", "en"];

export function normalizeLocale(value: unknown): Locale {
  return value === "es" ? "es" : "en";
}

export function detectLocale(): Locale {
  try {
    const language =
      typeof navigator !== "undefined" && typeof navigator.language === "string"
        ? navigator.language
        : "";
    if (language.toLowerCase().startsWith("es")) return "es";
  } catch {}
  return "en";
}

export function readStoredLocale(): Locale | null {
  try {
    const raw = window.localStorage.getItem(LOCALE_KEY);
    if (raw === "es" || raw === "en") return raw;
  } catch {}
  return null;
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_KEY, locale);
  } catch {}
}

export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  persistLocale(locale);
}
