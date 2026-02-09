// src/components/QuickLanguageSwitch.js
// ✅ Mini sélecteur de langue horizontal pour l'écran d'accueil

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useLanguage } from '../context/LanguageContext';

const QuickLanguageSwitch = ({ style }) => {
  const { currentLanguage, changeLanguage, isChangingLanguage } = useLanguage();

  const languages = [
    { code: 'he', flag: '🇮🇱', label: 'עב' },
    { code: 'fr', flag: '🇫🇷', label: 'FR' },
    { code: 'en', flag: '🇬🇧', label: 'EN' }
  ];

  const handlePress = (code) => {
    if (code !== currentLanguage && !isChangingLanguage) {
      changeLanguage(code);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {languages.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          onPress={() => handlePress(lang.code)}
          disabled={isChangingLanguage}
          style={[
            styles.languageButton,
            currentLanguage === lang.code && styles.activeButton,
            isChangingLanguage && styles.disabledButton
          ]}
        >
          <Text style={styles.flag}>{lang.flag}</Text>
          <Text style={[
            styles.label,
            currentLanguage === lang.code && styles.activeLabel
          ]}>
            {lang.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    gap: 6,
  },
  activeButton: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  disabledButton: {
    opacity: 0.5,
  },
  flag: {
    fontSize: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  activeLabel: {
    color: '#fff',
  },
});

export default QuickLanguageSwitch;