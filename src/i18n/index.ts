import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";
import en from "./locales/en.json";

const saved = (() => {
  try {
    return localStorage.getItem("lang");
  } catch {
    return null;
  }
})();
const lng = saved === "en" ? "en" : "es";

i18n.use(initReactI18next).init({
  lng,
  fallbackLng: "es",
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  interpolation: { escapeValue: false },
  initImmediate: false,
});

export default i18n;
