import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

const LanguageSettingsScreen = () => {
  const navigation = useNavigation();
  const { userInfo, updateUserInfo } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  
  const [selectedLanguage, setSelectedLanguage] = useState(
    userInfo?.language || t('languageSettings.languages.hebrew')
  );
  const [isLoading, setIsLoading] = useState(false);

  // Options de langue disponibles
  const languageOptions = [
    {
      id: 'he',
      name: t('languageSettings.languages.hebrew'),
      nativeName: t('languageSettings.languages.hebrewNative'),
      icon: 'language-outline',
    },
    {
      id: 'en',
      name: t('languageSettings.languages.english'),
      nativeName: t('languageSettings.languages.englishNative'),
      icon: 'language-outline',
    },
    {
      id: 'ar',
      name: t('languageSettings.languages.arabic'),
      nativeName: t('languageSettings.languages.arabicNative'),
      icon: 'language-outline',
    },
  ];

  // Gérer la sélection de langue
  const handleSelectLanguage = (language) => {
    setSelectedLanguage(language.name);
    setIsLoading(true);

    // Simuler un délai d'API
    setTimeout(() => {
      updateUserInfo({
        ...userInfo,
        language: language.name,
      });

      setIsLoading(false);
      navigation.goBack();
    }, 1000);
  };

  // Rendre un élément de la liste des langues
  const renderLanguageItem = ({ item }) => (
    <TouchableOpacity
      style={styles.languageOption}
      onPress={() => handleSelectLanguage(item)}
    >
      <View style={[styles.languageDetails, isRTL && styles.languageDetailsRTL]}>
        <Ionicons name={item.icon} size={24} color="#256FA8" />
        <View style={[styles.languageNames, isRTL && styles.languageNamesRTL]}>
          <Text style={[styles.languageName, isRTL && styles.textRTL]}>{item.name}</Text>
          <Text style={[styles.nativeName, isRTL && styles.textRTL]}>{item.nativeName}</Text>
        </View>
      </View>
      {selectedLanguage === item.name && (
        <Ionicons name="checkmark" size={24} color="#256FA8" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#1B2A36" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
          {t('languageSettings.title')}
        </Text>
        <View style={styles.placeholderButton} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#256FA8" />
          <Text style={[styles.loadingText, isRTL && styles.textRTL]}>
            {t('languageSettings.changing')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={languageOptions}
          renderItem={renderLanguageItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FAFD',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF3F7',
  },
  backButton: {
    padding: 8,
    borderRadius: 999,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholderButton: {
    width: 40,
    borderRadius: 999,
  },
  listContainer: {
    padding: 16,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#1B4F7A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  languageDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageDetailsRTL: {
    flexDirection: 'row-reverse',
  },
  languageNames: {
    marginLeft: 16,
  },
  languageNamesRTL: {
    marginLeft: 0,
    marginRight: 16,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B2A36',
  },
  nativeName: {
    fontSize: 14,
    color: '#5E6E7C',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#5E6E7C',
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});

export default LanguageSettingsScreen;
