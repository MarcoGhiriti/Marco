import * as Localization from "expo-localization";
import { en } from "./en";

export type Dictionary = typeof en;

const dictionaries = {
  en,
} as const;

export function t<K extends keyof Dictionary>(key: K): Dictionary[K];
export function t(key: string): any {
  // Force English (as requested). We keep Localization import for future expansion.
  // const locale = Localization.getLocales?.()?.[0]?.languageCode;
  const dict = dictionaries.en;
  return (dict as any)[key];
}

export const strings = en;
