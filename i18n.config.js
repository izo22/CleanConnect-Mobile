// i18n.config.js
// ✅ Configuration complète i18n pour CleanConnect (FR, EN, HE)

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';

// Importer les fichiers de traduction
const en = require('./locales/en.json');
const fr = require('./locales/fr.json');
const he = require('./locales/he.json');
const LANGUAGE_STORAGE_KEY = '@cleanconnect_language';

// Détection de la langue de l'appareil
const getDeviceLanguage = () => {
  const deviceLocale = Localization.locale; // Ex: "en-US", "fr-FR", "he-IL"
  const languageCode = deviceLocale.split('-')[0]; // Extraire "en", "fr", "he"
  
  // Si la langue de l'appareil est supportée, l'utiliser
  if (['en', 'fr', 'he'].includes(languageCode)) {
    return languageCode;
  }
  
  // Sinon, défaut à l'hébreu (marché israélien)
  return 'he';
};

// Charger la langue sauvegardée
const loadSavedLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return savedLanguage || getDeviceLanguage();
  } catch (error) {
    console.error('Erreur chargement langue:', error);
    return getDeviceLanguage();
  }
};

// Sauvegarder la langue choisie
export const saveLanguage = async (language) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.error('Erreur sauvegarde langue:', error);
  }
};

// Vérifier si une langue nécessite RTL
export const isRTL = (language) => {
  return language === 'he'; // L'hébreu nécessite RTL
};

// Configurer RTL
export const setRTL = (language) => {
  const shouldBeRTL = isRTL(language);
  
  // Vérifier si le changement est nécessaire
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.forceRTL(shouldBeRTL);
    I18nManager.allowRTL(shouldBeRTL);
  }
};

// Configuration i18n
const initI18n = async () => {
  const savedLanguage = await loadSavedLanguage();
  
  // Configurer RTL pour la langue chargée
  setRTL(savedLanguage);
  
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        fr: { translation: fr },
        he: { translation: he },
      },
      lng: savedLanguage, // Langue par défaut
      fallbackLng: 'he', // Langue de secours (hébreu pour le marché israélien)
      interpolation: {
        escapeValue: false, // React gère déjà l'échappement
      },
      react: {
        useSuspense: false, // Important pour React Native
      },
    });
  
  return i18n;
};

// Initialiser i18n au démarrage
initI18n();

export default i18n;