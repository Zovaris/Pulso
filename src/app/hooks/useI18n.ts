import { useCallback } from "react";
import { useStore } from "@/app/store";
import { type TplVars, translate } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function useI18n() {
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const t = useCallback(
    (key: string, vars?: TplVars) => translate(locale, key, vars),
    [locale],
  );
  return { locale, setLocale, t } satisfies {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, vars?: TplVars) => string;
  };
}
