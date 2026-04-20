// src/screens/auth/LoginScreen.js
// 🎨 VERSION ULTRA-MINIMALISTE PREMIUM
// Style inspiré de Stripe, Linear, Revolut

/*
CHANGEMENTS MAJEURS APPLIQUÉS :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TYPOGRAPHIE :
  - Titre principal : 18px (au lieu de 24px), weight 600, letterSpacing -0.3
  - Textes : 13px (au lieu de 14-16px), weight 400, letterSpacing -0.2
  - Inputs : 14px (au lieu de 16px), weight 400
  - Bouton CTA : 14px, weight 600
  - Line heights serrés : 1.3-1.4 partout

✅ COULEURS & FONDS :
  - Fond principal container : #F9FAFB (ultra-clair)
  - formContainer : fond blanc pur #FFFFFF
  - Inputs : fond #FFFFFF (pas #f9f9f9), bordure #F3F4F6
  - Textes : #6B7280 (gris doux)
  - Liens : #4a90e2 conservée
  - Erreurs : #EF4444

✅ BOUTONS :
  - Hauteur réduite : 40px (au lieu de 50px)
  - Border-radius : 8px maintenu
  - Ombres supprimées totalement
  - État disabled plus subtil

✅ CARD :
  - Border-radius : 12px (au lieu de 10px)
  - Bordure ultra-subtile : #F3F4F6, 1px
  - Ombres quasi-éliminées : shadowOpacity 0.03, elevation 1
  - Padding augmenté : 24px (au lieu de 20px)

✅ INPUTS :
  - Hauteur réduite : 40px (au lieu de 50px)
  - Fond blanc pur
  - Bordures ultra-légères #F3F4F6
  - Placeholder en #9CA3AF

✅ SPACING :
  - Espacements augmentés entre sections : 20px au lieu de 15px
  - Marges augmentées pour respiration
  - Structure par le vide

✅ ICONS :
  - Taille réduite : 20px (au lieu de 24px)
  - Couleur grise douce : #9CA3AF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const LoginScreen = ({ navigation, route }) => {
  const isRTL = true;
  // קבלת הרול מפרמטרי הניווט
  const { role = 'client' } = route.params || {};
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, error } = useContext(AuthContext);

  const handleLogin = async () => {
    // בדיקה בסיסית
    if (!email || !password) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await login(email, password, role);
      // הניווט יטופל על ידי הניווט הראשי בהתבסס על userToken ו-userRole
    } catch (error) {
      Alert.alert(
        'שגיאת התחברות',
        error.message || 'אימייל או סיסמה שגויים'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.formContainer}>
          <Text style={[styles.title, styles.textRTL]}>
            {role === 'provider' ? 'התחברות ספק' : 'התחברות לקוח'}
          </Text>
          
          {error && <Text style={[styles.errorText, styles.textRTL]}>{error}</Text>}
          
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.textRTL]}
              placeholder="אימייל"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.textRTL, { paddingLeft: 44 }]}
              placeholder="סיסמה"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={[styles.passwordToggle, styles.passwordToggleRTL]}
              onPress={toggleShowPassword}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[styles.forgotPassword, styles.forgotPasswordRTL]}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={[styles.forgotPasswordText, styles.textRTL]}>שכחת סיסמה?</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>התחבר</Text>
            )}
          </TouchableOpacity>
          
          <View style={[styles.registerContainer, styles.registerContainerRTL]}>
            <Text style={[styles.registerText, styles.textRTL]}>אין לך חשבון?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Welcome')}
            >
              <Text style={[styles.registerLink, { marginRight: 5, marginLeft: 0 }]}>הירשם</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONTAINERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB', // Fond ultra-clair
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CARD PRINCIPALE (Ultra-minimaliste)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF', // Blanc pur
    borderRadius: 12, // Arrondi augmenté
    padding: 24, // Padding augmenté
    borderWidth: 1,
    borderColor: '#F3F4F6', // Bordure ultra-subtile
    // Ombres quasi-éliminées
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, // Ultra-subtil
    shadowRadius: 2,
    elevation: 1, // Minimal
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TYPOGRAPHIE (Tailles réduites, weights légers, spacing serré)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  title: {
    fontSize: 18, // Réduit de 24px à 18px
    fontWeight: '600', // Semibold pour titre principal
    letterSpacing: -0.3,
    lineHeight: 18 * 1.3, // Line height serré
    marginBottom: 24, // Espacement augmenté
    textAlign: 'center',
    color: '#111827', // Noir profond
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INPUTS (Minimalistes, fond blanc, bordures subtiles)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  inputContainer: {
    marginBottom: 20, // Espacement augmenté (était 15px)
    position: 'relative',
  },
  input: {
    height: 40, // Réduit de 50px à 40px
    borderWidth: 1,
    borderColor: '#F3F4F6', // Bordure ultra-claire
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14, // Réduit de 16px à 14px
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 14 * 1.4,
    backgroundColor: '#FFFFFF', // Blanc pur (pas #f9f9f9)
    color: '#111827',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSWORD TOGGLE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 10, // Ajusté pour hauteur 40px
  },
  passwordToggleRTL: {
    right: 'auto',
    left: 12,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FORGOT PASSWORD LINK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24, // Espacement augmenté (était 20px)
  },
  forgotPasswordRTL: {
    alignSelf: 'flex-start',
  },
  forgotPasswordText: {
    color: '#4a90e2',
    fontSize: 13, // Réduit de 14px à 13px
    fontWeight: '500', // Légèrement plus prononcé
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BOUTON CTA (Hauteur réduite, pas d'ombre)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  button: {
    backgroundColor: '#4a90e2',
    height: 40, // Réduit de 50px à 40px
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    // Pas d'ombre
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD', // Plus subtil
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14, // Réduit de 16px à 14px
    fontWeight: '600', // Semibold pour CTA
    letterSpacing: -0.2,
    lineHeight: 14 * 1.3,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTER LINK (Footer minimaliste)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24, // Espacement augmenté (était 20px)
  },
  registerContainerRTL: {
    flexDirection: 'row-reverse',
  },
  registerText: {
    color: '#6B7280', // Gris doux
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
  },
  registerLink: {
    color: '#4a90e2',
    fontSize: 13,
    fontWeight: '600', // Semibold pour lien
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    marginLeft: 5,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ERREURS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    marginBottom: 20,
    textAlign: 'center',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RTL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default LoginScreen;