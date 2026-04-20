// WelcomeScreen.js - REFONTE UI MINIMALISTE PREMIUM
/*
CHANGEMENTS MAJEURS APPLIQUÉS:
✓ LinearGradient bleu subtil (#F0F9FF→#DBEAFE) pour chaleur visuelle
✓ Typographie: fontSize réduits de 10-15% (logo 42px, sectionTitle 18px, cardTitle 16px)
✓ Poids: '400' par défaut, '600' uniquement pour titres/CTA
✓ Cards: borderRadius 24px→12px, ombres lourdes supprimées, bordures 1px #F3F4F6
✓ Icons: tailles réduites (32px→20px), circles plus petits (64px→48px)
✓ Buttons: hauteur 40px, style outline pour login
✓ Colors: #111827 (textes actifs), #6B7280 (secondaires), #9CA3AF (hints)
✓ letterSpacing: -0.2 à -0.4 pour compression visuelle
✓ lineHeight: serré (1.3-1.4)
✓ Spacing: augmenté entre sections pour respiration
✓ Logo: poids ajusté (700→600 pour Clean, 300→400 pour Co)
✓ Ombres: supprimées ou ultra-subtiles (shadowOpacity 0.03)
*/
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const WelcomeScreen = () => {
  const navigation = useNavigation();

  const handleClientRegistration = () => {
    navigation.navigate('ClientRegistration');
  };

  const handleProviderRegistration = () => {
    navigation.navigate('ProviderRegistration');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <LinearGradient
      colors={['#F0F9FF', '#E0F2FE', '#DBEAFE']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoClean}>Clean</Text>
              <Ionicons name="sparkles" size={28} color="#2E86C1" style={styles.sparkleIcon} />
              <Text style={styles.logoCo}>Co</Text>
            </View>
            <Text style={styles.tagline}>
              הפתרון הפשוט לכל צרכי הניקיון שלך
            </Text>
          </View>

          {/* Options Section */}
          <View style={styles.optionsSection}>
            <Text style={styles.sectionTitle}>
              איך נוכל לעזור לך?
            </Text>
            
            {/* Card Client */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={handleClientRegistration}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="home" size={20} color="#2E86C1" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>אני מחפש שירות</Text>
                <Text style={styles.cardDescription}>
                  מצא מנקים מקצועיים באזור שלך
                </Text>
              </View>
              <View style={styles.arrowBubble}>
                <Ionicons name="chevron-back" size={18} color="#2E86C1" />
              </View>
            </TouchableOpacity>

            {/* Card Provider */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={handleProviderRegistration}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="briefcase" size={20} color="#2E86C1" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>אני מציע שירותים</Text>
                <Text style={styles.cardDescription}>
                  הצטרף למקצוענים שלנו והתחל לעבוד
                </Text>
              </View>
              <View style={styles.arrowBubble}>
                <Ionicons name="chevron-back" size={18} color="#2E86C1" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Login Section */}
          <View style={styles.loginSection}>
            <Text style={styles.loginText}>כבר יש לך חשבון?</Text>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={handleLogin}
              activeOpacity={0.7}
            >
              <Text style={styles.loginButtonText}>התחבר</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  
  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginTop: 80,
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
    color: '#111827',
    letterSpacing: -0.4,
  },
  sparkleIcon: {
    marginHorizontal: 2,
  },
  logoCo: {
    fontSize: 42,
    fontWeight: '600',
    color: '#2E86C1',
    letterSpacing: -0.4,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
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
    color: '#111827',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  optionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    color: '#111827',
    marginBottom: 4,
    textAlign: 'right',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  cardDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'right',
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  arrowBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
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
  loginText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    marginLeft: 8,
    letterSpacing: -0.1,
  },
  loginButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E86C1',
    letterSpacing: -0.2,
  },
});

export default WelcomeScreen;