import type { TplVars } from "@/lib/i18n";
import type { Locale, Surface, ThemePref } from "@/lib/types";

export type StoreState = {
  surface: Surface;
  locale: Locale;
  themePref: ThemePref;
  transparency: boolean;
};

export type StoreActions = {
  setLocale: (locale: Locale) => void;
  setThemePref: (pref: ThemePref) => void;
  setTransparency: (value: boolean) => void;
  t: (key: string, vars?: TplVars) => string;
};

export type AppStore = StoreState & StoreActions;
