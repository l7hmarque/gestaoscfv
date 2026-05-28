import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";
import esAR from "./locales/es-AR.json";
import itIT from "./locales/it-IT.json";

/**
 * i18n nativo do SysCFV.
 * - Não traduz conteúdo do usuário (nomes, CPF, endereços, relatórios).
 * - Traduz somente UI (menus, botões, títulos de seção, labels).
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "pt-BR",
    supportedLngs: ["pt-BR", "en-US", "es-AR", "it-IT"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "syscfv_lang",
      caches: ["localStorage"],
    },
    resources: {
      "pt-BR": { translation: ptBR },
      "en-US": { translation: enUS },
      "es-AR": { translation: esAR },
      "it-IT": { translation: itIT },
    },
  });

export default i18n;