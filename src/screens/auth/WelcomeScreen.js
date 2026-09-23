// WelcomeScreen.js — CleanCasa · bleu clair (maquette 07)
// Pour une photo : remplacer <View style={styles.hero}> par
// <ImageBackground source={require('../../assets/images/welcome.jpg')} style={styles.hero}>
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { palette as C } from '../../config/theme';

const translations = {
  he: {
    title: 'בית נקי יותר.\nראש שקט יותר.',
    tagline: 'הפתרון הפשוט לכל צרכי הניקיון שלך',
    clientTitle: 'אני מחפש שירות',
    clientDesc: 'מצא מנקים מקצועיים באזור שלך',
    providerTitle: 'אני מציע שירותים',
    providerDesc: 'הצטרף למקצוענים שלנו והתחל לעבוד',
    loginText: 'כבר יש לך חשבון?',
    loginBtn: 'התחבר',
  },
  en: {
    title: 'A cleaner home.\nA calmer you.',
    tagline: 'The simple solution for all your cleaning needs',
    clientTitle: "I'm looking for a service",
    clientDesc: 'Find professional cleaners in your area',
    providerTitle: 'I offer services',
    providerDesc: 'Join our professionals and start working',
    loginText: 'Already have an account?',
    loginBtn: 'Log in',
  },
};

const WelcomeScreen = () => {
  const navigation = useNavigation();
  const [lang, setLang] = useState('he');
  const isRTL = lang === 'he';
  const t = translations[lang];
  const row = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.tint} translucent={false} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={[styles.langToggle, { alignSelf: isRTL ? 'flex-start' : 'flex-end' }]}>
              {['he', 'en'].map((l) => (
                <TouchableOpacity key={l} style={[styles.langBtn, lang === l && styles.langBtnActive]} onPress={() => setLang(l)}>
                  <Text style={[styles.langText, lang === l && styles.langTextActive]}>{l === 'he' ? 'עב' : 'EN'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="home" size={56} color={C.primary} />
            </View>
          </View>

          <View style={styles.body}>
            <View style={[styles.brandRow, { flexDirection: row }]}>
              <Ionicons name="home" size={28} color={C.primary} />
              <Text style={styles.brand}>CleanConnect</Text>
            </View>
            <Text style={[styles.title, { textAlign: align }]}>{t.title}</Text>
            <Text style={[styles.tagline, { textAlign: align }]}>{t.tagline}</Text>

            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={() => navigation.navigate('ClientRegistration')}>
              <View style={[styles.btnInner, { flexDirection: row }]}>
                <Ionicons name="home-outline" size={20} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.primaryTitle, { textAlign: align }]}>{t.clientTitle}</Text>
                  <Text style={[styles.primaryDesc, { textAlign: align }]}>{t.clientDesc}</Text>
                </View>
                <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={() => navigation.navigate('ProviderRegistration')}>
              <View style={[styles.btnInner, { flexDirection: row }]}>
                <Ionicons name="briefcase-outline" size={20} color={C.primaryDark} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.secondaryTitle, { textAlign: align }]}>{t.providerTitle}</Text>
                  <Text style={[styles.secondaryDesc, { textAlign: align }]}>{t.providerDesc}</Text>
                </View>
                <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color={C.primaryDark} />
              </View>
            </TouchableOpacity>

            <View style={[styles.loginRow, { flexDirection: row }]}>
              <Text style={styles.loginText}>{t.loginText}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>{t.loginBtn}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  content: { flexGrow: 1 },
  hero: { height: 300, backgroundColor: C.tint, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, padding: 18, justifyContent: 'space-between' },
  heroIcon: { alignSelf: 'center', width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 60 },
  langToggle: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 999, padding: 3, gap: 2 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  langBtnActive: { backgroundColor: C.primary },
  langText: { fontSize: 12, fontWeight: '600', color: C.brand },
  langTextActive: { color: '#FFFFFF' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 14 },
  brandRow: { alignItems: 'center', gap: 8 },
  brand: { fontSize: 22, fontWeight: '700', color: C.brand },
  title: { fontSize: 28, fontWeight: '700', color: C.ink, lineHeight: 36 },
  tagline: { fontSize: 15, color: C.muted, lineHeight: 22, marginBottom: 8 },
  btnInner: { alignItems: 'center', gap: 12 },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18 },
  primaryTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  primaryDesc: { fontSize: 12, color: '#FFFFFF', marginTop: 2 },
  secondaryBtn: { borderWidth: 1.5, borderColor: C.primary, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: '#FFFFFF' },
  secondaryTitle: { fontSize: 16, fontWeight: '600', color: C.primaryDark },
  secondaryDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  loginRow: { justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
  loginText: { fontSize: 14, color: C.muted },
  loginLink: { fontSize: 14, fontWeight: '600', color: C.primary },
});

export default WelcomeScreen;
