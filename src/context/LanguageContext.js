// src/context/LanguageContext.js
// ✅ Contexte pour gérer le changement de langue dans toute l'app

import React, { createContext, useState, useContext, useEffect } from 'react';
import { I18nManager, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import i18n, { saveLanguage, isRTL, setRTL } from '../../i18n.config';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage doit être utilisé à l\'intérieur d\'un LanguageProvider');
  }
  return context;
};

const LANGUAGE_STORAGE_KEY = '@cleanconnect_language';

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);

  // Charger la langue au démarrage
  useEffect(() => {
    loadLanguage();
  }, []);

  // Charger la langue sauvegardée
  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && savedLanguage !== currentLanguage) {
        await changeLanguage(savedLanguage, false); // false = pas de reload
      }
    } catch (error) {
      console.error('Erreur chargement langue:', error);
    }
  };

  // Changer de langue
  const changeLanguage = async (newLanguage, needsReload = true) => {
    // Vérifier que la langue est supportée
    if (!['en', 'fr', 'he'].includes(newLanguage)) {
      console.error('Langue non supportée:', newLanguage);
      return;
    }

    // Si c'est déjà la langue actuelle, ne rien faire
    if (newLanguage === currentLanguage && !needsReload) {
      return;
    }

    setIsChangingLanguage(true);

    try {
      // Vérifier si changement RTL nécessaire
      const currentIsRTL = I18nManager.isRTL;
      const newIsRTL = isRTL(newLanguage);
      const needsRTLChange = currentIsRTL !== newIsRTL;

      // Changer la langue dans i18n
      await i18n.changeLanguage(newLanguage);
      
      // Sauvegarder dans AsyncStorage
      await saveLanguage(newLanguage);
      
      // Mettre à jour l'état local
      setCurrentLanguage(newLanguage);

      // Si changement RTL nécessaire, afficher une alerte
      if (needsRTLChange && needsReload) {
        setRTL(newLanguage);
        
        Alert.alert(
          getAlertTitle(newLanguage),
          getAlertMessage(newLanguage),
          [
            {
              text: getAlertButton(newLanguage),
              onPress: async () => {
                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                  // Recharger l'app pour appliquer RTL
                  try {
                    await Updates.reloadAsync();
                  } catch (error) {
                    console.error('Erreur reload app:', error);
                    // Fallback: demander à l'utilisateur de fermer/rouvrir l'app
                    Alert.alert(
                      'Redémarrage nécessaire',
                      'Veuillez fermer et rouvrir l\'application pour appliquer les changements.'
                    );
                  }
                }
              },
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      console.error('Erreur changement langue:', error);
      Alert.alert('Erreur', 'Impossible de changer la langue. Veuillez réessayer.');
    } finally {
      setIsChangingLanguage(false);
    }
  };

  // Obtenir les textes d'alerte selon la nouvelle langue
  const getAlertTitle = (lang) => {
    const titles = {
      en: 'Restart Required',
      fr: 'Redémarrage requis',
      he: 'נדרש אתחול מחדש',
    };
    return titles[lang] || titles.en;
  };

  const getAlertMessage = (lang) => {
    const messages = {
      en: 'The app needs to restart to apply the language change.',
      fr: 'L\'application doit redémarrer pour appliquer le changement de langue.',
      he: 'האפליקציה צריכה להיטען מחדש כדי להחיל את שינוי השפה.',
    };
    return messages[lang] || messages.en;
  };

  const getAlertButton = (lang) => {
    const buttons = {
      en: 'Restart Now',
      fr: 'Redémarrer maintenant',
      he: 'אתחל עכשיו',
    };
    return buttons[lang] || buttons.en;
  };

  // Obtenir le nom de la langue
  const getLanguageName = (code) => {
    const names = {
      en: 'English',
      fr: 'Français',
      he: 'עברית',
    };
    return names[code] || code;
  };

  // Obtenir toutes les langues disponibles
  const getAvailableLanguages = () => {
    return [
      { code: 'he', name: 'עברית', flag: '🇮🇱' },
      { code: 'en', name: 'English', flag: '🇬🇧' },
      { code: 'fr', name: 'Français', flag: '🇫🇷' },
    ];
  };

  const value = {
    currentLanguage,
    changeLanguage,
    isChangingLanguage,
    getLanguageName,
    getAvailableLanguages,
    isRTL: isRTL(currentLanguage),
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};