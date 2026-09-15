import type { Locale } from "../types";
import type { Dict, PluralForms } from "./locales";
import { en, es } from "./locales";

export type { Locale } from "../types";
export {
  applyDocumentLocale,
  detectLocale,
  persistLocale,
  readStoredLocale,
} from "./locale";
export type { Dict, PluralForms } from "./locales";

export type TplVars = Record<string, string | number | boolean>;

function lookup(dict: Dict, key: string): unknown {
  if (Object.keys(dict).includes(key)) return dict[key];
  let current: unknown = dict;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function interpolate(
  template: string,
  vars: TplVars | undefined,
  locale: Locale,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined
      ? match
      : typeof value === "number"
        ? new Intl.NumberFormat(locale).format(value)
        : String(value);
  });
}

function countOf(vars?: TplVars): number {
  const raw = vars?.count;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function pickPlural(locale: Locale, count: number): string {
  try {
    return new Intl.PluralRules(locale).select(count);
  } catch {
    return "other";
  }
}

export function translate(locale: Locale, key: string, vars?: TplVars): string {
  const primary = locale === "es" ? es : en;
  const fallback = locale === "es" ? en : es;
  const value = lookup(primary, key) ?? lookup(fallback, key);
  if (typeof value === "string") return interpolate(value, vars, locale);
  if (typeof value === "object" && value !== null) {
    const forms = value as PluralForms;
    const template =
      forms[pickPlural(locale, countOf(vars)) as "one"] ?? forms.other ?? key;
    return interpolate(template, vars, locale);
  }
  return key;
}

export function t(locale: Locale, key: string, vars?: TplVars): string {
  return translate(locale, key, vars);
}
