"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/db/types";
import { en } from "./messages/en";
import { es } from "./messages/es";

export type MessageKey = keyof typeof en;
type Params = Record<string, string | number>;
export type TFn = (key: MessageKey, params?: Params) => string;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, es };

interface I18nValue {
  locale: Locale;
  t: TFn;
}

const I18nContext = createContext<I18nValue>({ locale: "en", t: (key) => en[key] });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const dict = dictionaries[locale];
  const t = useCallback<TFn>(
    (key, params) => {
      const template = dict[key] ?? en[key];
      return params ? template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`)) : template;
    },
    [dict],
  );
  const value = useMemo(() => ({ locale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useT = () => useContext(I18nContext).t;
export const useLocale = () => useContext(I18nContext).locale;
