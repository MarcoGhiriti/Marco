import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ro from "./ro";
import en from "./en";

const STORAGE_KEY = "app_language";

const resources = {
  ro: { translation: ro },
  en: { translation: en },
};

const deviceLang = getLocales()?.[0]?.languageCode ?? "ro";
const fallback = deviceLang === "en" ? "en" : "ro";

i18n.use(initReactI18next).init({
  resources,
  lng: fallback,
  fallbackLng: "ro",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

AsyncStorage.getItem(STORAGE_KEY).then((lang) => {
  if (lang && (lang === "ro" || lang === "en")) {
    i18n.changeLanguage(lang);
  }
});

export const setLanguage = async (lang: "ro" | "en") => {
  await AsyncStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
};

export default i18n;
