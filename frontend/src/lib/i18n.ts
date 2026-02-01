import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import en from "../locales/en.json";

const resources = {
  en: {
    translation: en,
  },
} as const;

// Detect device locale, default to English.
const deviceLocale = (Localization.getLocales()?.[0]?.languageCode || "en").toLowerCase();
const initialLng = deviceLocale in resources ? deviceLocale : "en";

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLng,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

export default i18n;
