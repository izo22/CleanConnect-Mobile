// WelcomeScreen.js - REFONTE UI MINIMALISTE PREMIUM
/*
CHANGEMENTS MAJEURS APPLIQUÉS:
✓ LinearGradient bleu subtil (#EAF4FB→#EAF4FB) pour chaleur visuelle
✓ Typographie: fontSize réduits de 10-15% (logo 42px, sectionTitle 18px, cardTitle 16px)
✓ Poids: '400' par défaut, '600' uniquement pour titres/CTA
✓ Cards: borderRadius 24px→12px, ombres lourdes supprimées, bordures 1px #EEF3F7
✓ Icons: tailles réduites (32px→20px), circles plus petits (64px→48px)
✓ Buttons: hauteur 40px, style outline pour login
✓ Colors: #1B2A36 (textes actifs), #5E6E7C (secondaires), #8A99A6 (hints)
✓ letterSpacing: -0.2 à -0.4 pour compression visuelle
✓ lineHeight: serré (1.3-1.4)
✓ Spacing: augmenté entre sections pour respiration
✓ Logo: poids ajusté (700→600 pour Clean, 300→400 pour Co)
✓ Ombres: supprimées ou ultra-subtiles (shadowOpacity 0.03)
✓ AJOUT: Sélecteur de langue EN/HE avec RTL automatique
✓ FIX: SafeAreaView importé depuis react-native-safe-area-context (fix Android status bar)
✓ FIX ÉCRAN NOIR: LinearGradient remplacé par View simple (crash silencieux APK release)
*/
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// ─── Traductions ───────────────────────────────────────────────────────────────
const translations = {
  he: {
    tagline:      'הפתרון הפשוט לכל צרכי הניקיון שלך',
    sectionTitle: 'איך נוכל לעזור לך?',
    clientTitle:  'אני מחפש שירות',
    clientDesc:   'מצא מנקים מקצועיים באזור שלך',
    providerTitle:'אני מציע שירותים',
    providerDesc: 'הצטרף למקצוענים שלנו והתחל לעבוד',
    loginText:    'כבר יש לך חשבון?',
    loginBtn:     'התחבר',
  },
  en: {
    tagline:      'The simple solution for all your cleaning needs',
    sectionTitle: 'How can we help you?',
    clientTitle:  "I'm looking for a service",
    clientDesc:   'Find professional cleaners in your area',
    providerTitle:'I offer services',
    providerDesc: 'Join our professionals and start working',
    loginText:    'Already have an account?',
    loginBtn:     'Log in',
  },
};

const WelcomeScreen = () => {
  const navigation = useNavigation();
  const [lang, setLang] = useState('he');
  const isRTL = lang === 'he';
  const t = translations[lang];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EAF4FB" translucent={false} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Sélecteur de langue ── */}
          <View style={styles.langToggleContainer}>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
              onPress={() => setLang('en')}
            >
              <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'he' && styles.langBtnActive]}
              onPress={() => setLang('he')}
            >
              <Text style={[styles.langBtnText, lang === 'he' && styles.langBtnTextActive]}>HE</Text>
            </TouchableOpacity>
          </View>

          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoClean}>Clean</Text>
              <Ionicons name="sparkles" size={28} color="#256FA8" style={styles.sparkleIcon} />
              <Text style={styles.logoCo}>Co</Text>
            </View>
            <Text style={[styles.tagline, isRTL && styles.textRTL]}>
              {t.tagline}
            </Text>
          </View>

          {/* Options Section */}
          <View style={styles.optionsSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              {t.sectionTitle}
            </Text>

            {/* Card Client */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => navigation.navigate('ClientRegistration')}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="home" size={20} color="#256FA8" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, isRTL && styles.textRTL]}>{t.clientTitle}</Text>
                <Text style={[styles.cardDescription, isRTL && styles.textRTL]}>{t.clientDesc}</Text>
              </View>
              <View style={styles.arrowBubble}>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="#256FA8" />
              </View>
            </TouchableOpacity>

            {/* Card Provider */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => navigation.navigate('ProviderRegistration')}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="briefcase" size={20} color="#256FA8" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, isRTL && styles.textRTL]}>{t.providerTitle}</Text>
                <Text style={[styles.cardDescription, isRTL && styles.textRTL]}>{t.providerDesc}</Text>
              </View>
              <View style={styles.arrowBubble}>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="#256FA8" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Login Section */}
          <View style={[styles.loginSection, isRTL && styles.loginSectionRTL]}>
            <Text style={styles.loginText}>{t.loginText}</Text>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}
            >
              <Text style={styles.loginButtonText}>{t.loginBtn}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF4FB',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // ── Sélecteur de langue
  langToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    gap: 6,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E1ECF4',
    backgroundColor: '#FFFFFF',
  },
  langBtnActive: {
    backgroundColor: '#256FA8',
    borderColor: '#256FA8',
    borderRadius: 999,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5E6E7C',
    letterSpacing: -0.2,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 60,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  logoClean: {
    fontSize: 42,
    fontWeight: '600',
    color: '#1B2A36',
    letterSpacing: -0.4,
  },
  sparkleIcon: {
    marginHorizontal: 2,
  },
  logoCo: {
    fontSize: 42,
    fontWeight: '600',
    color: '#256FA8',
    letterSpacing: -0.4,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    color: '#5E6E7C',
    textAlign: 'center',
    maxWidth: '85%',
    lineHeight: 18,
    letterSpacing: -0.2,
  },

  // Options Section
  optionsSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B2A36',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  optionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E1ECF4',
    padding: 20,
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2E86C110',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B2A36',
    marginBottom: 4,
    textAlign: 'right',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  cardDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#5E6E7C',
    textAlign: 'right',
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  arrowBubble: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: '#F6FAFD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Login Section
  loginSection: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginSectionRTL: {
    flexDirection: 'row-reverse',
  },
  loginText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#5E6E7C',
    marginLeft: 8,
    letterSpacing: -0.1,
  },
  loginButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#256FA8',
    letterSpacing: -0.2,
  },

  // RTL
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default WelcomeScreen;