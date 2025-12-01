// src/components/LanguageSelector.js
// ✅ Composant pour sélectionner la langue de l'application

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, List, RadioButton, Divider, ActivityIndicator } from 'react-native-paper';
import { useLanguage } from '../context/LanguageContext';
import { useTranslation } from 'react-i18next';

const LanguageSelector = ({ containerStyle, showTitle = true }) => {
  const { t } = useTranslation();
  const {
    currentLanguage,
    changeLanguage,
    isChangingLanguage,
    getAvailableLanguages,
  } = useLanguage();

  const languages = getAvailableLanguages();

  const handleLanguageChange = (languageCode) => {
    if (languageCode !== currentLanguage && !isChangingLanguage) {
      changeLanguage(languageCode);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {showTitle && (
        <Text style={styles.title}>
          {t('langue') || 'Langue / Language / שפה'}
        </Text>
      )}

      {languages.map((language, index) => (
        <React.Fragment key={language.code}>
          <TouchableOpacity
            onPress={() => handleLanguageChange(language.code)}
            disabled={isChangingLanguage}
            style={styles.languageItem}
          >
            <View style={styles.languageContent}>
              <Text style={styles.languageFlag}>{language.flag}</Text>
              <Text style={styles.languageName}>{language.name}</Text>
            </View>
            
            <View style={styles.rightContent}>
              {isChangingLanguage && currentLanguage === language.code ? (
                <ActivityIndicator size="small" />
              ) : (
                <RadioButton
                  value={language.code}
                  status={currentLanguage === language.code ? 'checked' : 'unchecked'}
                  onPress={() => handleLanguageChange(language.code)}
                  disabled={isChangingLanguage}
                />
              )}
            </View>
          </TouchableOpacity>
          
          {index < languages.length - 1 && <Divider />}
        </React.Fragment>
      ))}

      {isChangingLanguage && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            {t('changement_langue') || 'Changing language...'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    paddingBottom: 10,
    color: '#333',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    fontSize: 16,
    color: '#333',
  },
  rightContent: {
    marginLeft: 10,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
});

export default LanguageSelector;