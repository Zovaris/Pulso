import enCommon from "./locales/en/common.json";
import esCommon from "./locales/es/common.json";

export type PluralForms = { one?: string; other: string };
export type Dict = {
  [key: string]: string | PluralForms | Dict;
};

export const en: Dict = { ...enCommon, common: enCommon };
export const es: Dict = { ...esCommon, common: esCommon };
