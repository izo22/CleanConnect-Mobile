// LanguageSettingsScreen.js — CleanCasa · bleu clair
import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { palette as C } from '../../config/theme';

const LanguageSettingsScreen = () => {
  const navigation = useNavigation();
  const { userInfo, updateUserInfo } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const row = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';

  const [selectedLanguage, setSelectedLanguage] = useState(userInfo?.language || t('languageSettings.languages.hebrew', 'עברית'));
  const [isLoading, setIsLoading] = useState(false);

  const languageOptions = [
    { id: 'he', code: 'עב', name: t('languageSettings.languages.hebrew', 'עברית'), nativeName: t('languageSettings.languages.hebrewNative', 'עברית') },
    { id: 'en', code: 'EN', name: t('languageSettings.languages.english', 'אנגלית'), nativeName: t('languageSettings.languages.englishNative', 'English') },
    { id: 'ar', code: 'ع', name: t('languageSettings.languages.arabic', 'ערבית'), nativeName: t('languageSettings.languages.arabicNative', 'العربية') },
  ];

  const handleSelectLanguage = (language) => {
    setSelectedLanguage(language.name);
    setIsLoading(true);
    setTimeout(() => {
      updateUserInfo({ ...userInfo, language: language.name });
      setIsLoading(false);
      navigation.goBack();
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { flexDirection: row }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} disabled={isLoading}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('languageSettings.title', 'שפה')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>{t('languageSettings.changing', 'מחליף שפה...')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {languageOptions.map((item) => {
            const active = selectedLanguage === item.name;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.option, { flexDirection: row }, active && styles.optionActive]}
                onPress={() => handleSelectLanguage(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.code, active && styles.codeActive]}>
                  <Text style={[styles.codeText, active && { color: '#FFFFFF' }]}>{item.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { textAlign: align }]}>{item.name}</Text>
                  <Text style={[styles.native, { textAlign: align }]}>{item.nativeName}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E8EFF5' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.input, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: C.ink },
  list: { padding: 18, gap: 10 },
  option: { alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14 },
  optionActive: { borderColor: C.accent, borderWidth: 1.5 },
  code: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  codeActive: { backgroundColor: C.primary },
  codeText: { fontSize: 14, fontWeight: '700', color: C.primaryDark },
  name: { fontSize: 16, fontWeight: '600', color: C.ink },
  native: { fontSize: 13, color: C.muted, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#B9C7D3', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: C.muted },
});

export default LanguageSettingsScreen;
