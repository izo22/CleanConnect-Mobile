// src/i18n.js
// ✅ Configuration i18next pour CleanConnect - HÉBREU UNIQUEMENT

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import he from './locales/he.json';

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      he: { translation: he }
    },
    lng: 'he', // Hébreu forcé
    fallbackLng: 'he', // Toujours hébreu
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

console.log('✅ i18n initialisé - HÉBREU UNIQUEMENT');

export default i18n;