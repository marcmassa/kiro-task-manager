import type esTranslation from "./locales/es.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof esTranslation;
    };
  }
}
