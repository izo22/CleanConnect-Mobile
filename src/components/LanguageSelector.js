import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, RadioButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { changeLanguage, isRTL } from '../i18n/i18n.config';

const LanguageSelector = () => {
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = React.useState(i18n.language);

  const languages = [
    { code: 'he', name: 'עברית', flag: '🇮🇱', nativeName: 'עברית' },
    { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
    { code: 'fr', name: 'Français', flag: '🇫🇷', nativeName: 'Français' },
  ];

  const handleLanguageChange = async (languageCode) => {
    setSelectedLanguage(languageCode);
    const success = await changeLanguage(languageCode);
    
    if (success) {
      if (isRTL() !== (languageCode === 'he' || languageCode === 'ar')) {
        Alert.alert(
          'Attention',
          'L\'application doit redémarrer pour que le changement de direction de texte prenne effet.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choisir la langue</Text>
      
      <RadioButton.Group 
        onValueChange={handleLanguageChange} 
        value={selectedLanguage}
      >
        {languages.map((language) => (
          <TouchableOpacity
            key={language.code}
            style={styles.languageOption}
            onPress={() => handleLanguageChange(language.code)}
          >
            <View style={styles.languageRow}>
              <Text style={styles.flag}>{language.flag}</Text>
              <View style={styles.languageText}>
                <Text style={styles.languageName}>{language.name}</Text>
                <Text style={styles.languageNative}>{language.nativeName}</Text>
              </View>
            </View>
            <RadioButton value={language.code} />
          </TouchableOpacity>
        ))}
      </RadioButton.Group>

      <Text style={styles.note}>
        * Le changement de langue prend effet immédiatement
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 32,
    marginRight: 15,
  },
  languageText: {
    flexDirection: 'column',
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
  },
  languageNative: {
    fontSize: 14,
    color: '#666',
  },
  note: {
    marginTop: 20,
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default LanguageSelector;
