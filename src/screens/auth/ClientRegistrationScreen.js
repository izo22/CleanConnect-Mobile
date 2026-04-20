// src/screens/auth/ClientRegistrationScreen.js
// 🎨 VERSION ULTRA-MINIMALISTE PREMIUM
// Style inspiré de Stripe, Linear, Revolut

/*
CHANGEMENTS MAJEURS APPLIQUÉS :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TYPOGRAPHIE :
  - Titre principal : 18px (au lieu de 24px), weight 600, letterSpacing -0.3
  - Labels : 13px (au lieu de 16px), weight 400, letterSpacing -0.2
  - Inputs : 14px (au lieu de 16px), weight 400
  - Bouton CTA : 14px, weight 600
  - Line heights serrés : 1.3-1.4 partout

✅ COULEURS & FONDS :
  - Fond principal : #F9FAFB (ultra-clair)
  - formContainer : fond blanc pur #FFFFFF
  - Inputs : fond #FFFFFF (pas #f9f9f9), bordure #F3F4F6
  - Textes labels : #6B7280 (gris doux)
  - Couleur primaire : #4a90e2 conservée

✅ BOUTONS :
  - Hauteur réduite : 40px (au lieu de 50px)
  - Border-radius : 8px maintenu
  - Ombres supprimées totalement
  - État disabled plus subtil

✅ CARDS :
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
  - Espacements doublés entre sections : 24px (au lieu de 15px)
  - Marges augmentées pour respiration
  - Pas de séparateurs visuels

✅ ICONS :
  - Taille réduite : 20px (au lieu de 24px)
  - Couleur grise douce : #9CA3AF

✅ ERREURS :
  - Font-size réduit : 11px (au lieu de 12px)
  - Couleur rouge maintenue mais style plus subtil

✅ FIX ANDROID :
  - lineHeight supprimé des inputs (causait texte invisible/coupé sur Android)
  - KeyboardAvoidingView ajouté (clavier obscurcissait les champs mot de passe)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import CityModalSelector from '../../components/CityModalSelector';

const ClientRegistrationScreen = ({ navigation }) => {
  const isRTL = true;

  // États pour les champs du formulaire
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  
  // État pour les erreurs de validation
  const [errors, setErrors] = useState({});
  
  // Contexte d'authentification
  const { registerClient, error } = useContext(AuthContext);

  // Validation du formulaire
  const validateForm = () => {
    let isValid = true;
    let newErrors = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'שם פרטי הוא שדה חובה';
      isValid = false;
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'שם משפחה הוא שדה חובה';
      isValid = false;
    }

    if (!email.trim()) {
      newErrors.email = 'אימייל הוא שדה חובה';
      isValid = false;
    } else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      newErrors.email = 'אימייל לא תקין';
      isValid = false;
    }

    if (!phone.trim()) {
      newErrors.phone = 'מספר טלפון הוא שדה חובה';
      isValid = false;
    }

    if (!address.trim()) {
      newErrors.address = 'כתובת היא שדה חובה';
      isValid = false;
    }

    if (!city) {
      newErrors.city = 'עיר היא שדה חובה';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'סיסמה היא שדה חובה';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים';
      isValid = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'הסיסמאות אינן תואמות';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Soumission du formulaire
  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const userData = {
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        password,
      };

      await registerClient(userData);
      
    } catch (error) {
      Alert.alert(
        'שגיאת הרשמה',
        error.message || 'אירעה שגיאה במהלך ההרשמה. אנא נסה שוב.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleCitySelect = (selectedCity) => {
    setCity(selectedCity);
    // Effacer l'erreur de ville si elle existe
    if (errors.city) {
      setErrors({ ...errors, city: null });
    }
  };

  // Contenu du formulaire
  const renderContent = () => (
    <View style={styles.formContainer}>
      <Text style={[styles.title, styles.textRTL]}>
        הרשמת לקוח
      </Text>
      
      {error && (
        <Text style={[styles.generalError, styles.textRTL]}>
          {error}
        </Text>
      )}

      {/* Prénom */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>
          שם פרטי
        </Text>
        <TextInput
          style={[
            styles.input,
            errors.firstName && styles.inputError,
            styles.textRTL
          ]}
          placeholder="הזן את שמך הפרטי"
          placeholderTextColor="#9CA3AF"
          value={firstName}
          onChangeText={setFirstName}
        />
        {errors.firstName && (
          <Text style={[styles.errorText, styles.textRTL]}>
            {errors.firstName}
          </Text>
        )}
      </View>

      {/* Nom */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>
          שם משפחה
        </Text>
        <TextInput
          style={[
            styles.input,
            errors.lastName && styles.inputError,
            styles.textRTL
          ]}
          placeholder="הזן את שם המשפחה שלך"
          placeholderTextColor="#9CA3AF"
          value={lastName}
          onChangeText={setLastName}
        />
        {errors.lastName && (
          <Text style={[styles.errorText, styles.textRTL]}>
            {errors.lastName}
          </Text>
        )}
      </View>

      {/* Email */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>
          אימייל
        </Text>
        <TextInput
          style={[
            styles.input,
            errors.email && styles.inputError
          ]}
          placeholder="example@email.com"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && (
          <Text style={[styles.errorText, styles.textRTL]}>
            {errors.email}
          </Text>
        )}
      </View>

      {/* Téléphone */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>
          טלפון
        </Text>
        <TextInput
          style={[
            styles.input,
            errors.phone && styles.inputError
          ]}
          placeholder="05X-XXX-XXXX"
          placeholderTextColor="#9CA3AF"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        {errors.phone && (
          <Text style={[styles.errorText, styles.textRTL]}>
            {errors.phone}
          </Text>
        )}
      </View>

      {/* Champ Adresse */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>
          כתובת
        </Text>
        <TextInput
          style={[
            styles.input,
            errors.address && styles.inputError,
            styles.textRTL
          ]}
          placeholder="רחוב ומספר בית"
          placeholderTextColor="#9CA3AF"
          value={address}
          onChangeText={setAddress}
        />
        {errors.address && (
          <Text style={[styles.errorText, styles.textRTL]}>
            {errors.address}
          </Text>
        )}
      </View>

      {/* Sélecteur de ville - VERSION MODAL */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>
          עיר
        </Text>
        <TouchableOpacity
          style={[
            styles.cityButton,
            errors.city && styles.inputError
          ]}
          onPress={() => setShowCityModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="chevron-down" 
            size={20} 
            color="#9CA3AF"
            style={styles.cityIcon}
          />
          <Text style={[
            styles.cityButtonText,
            !city && styles.cityPlaceholder
          ]}>
            {city || 'בחר עיר'}
          </Text>
        </TouchableOpacity>
        {errors.city && (
          <Text style={[styles.errorText, styles.textRTL]}>
            {errors.city}
          </Text>
        )}
      </View>

      {/* Mot de passe */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>
          סיסמה
        </Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[
              styles.input, 
              styles.passwordInput, 
              errors.password && styles.inputError,
              styles.textRTL
            ]}
            placeholder="הזן סיסמה (לפחות 6 תווים)"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={toggleShowPassword}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>
        {errors.password && (
          <Text style={[styles.errorText, styles.textRTL]}>
            {errors.password}
          </Text>
        )}
      </View>

      {/* Confirmation du mot de passe */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>
          אימות סיסמה
        </Text>
        <TextInput
          style={[
            styles.input,
            errors.confirmPassword && styles.inputError,
            styles.textRTL
          ]}
          placeholder="הזן את הסיסמה שוב"
          placeholderTextColor="#9CA3AF"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
        />
        {errors.confirmPassword && (
          <Text style={[styles.errorText, styles.textRTL]}>
            {errors.confirmPassword}
          </Text>
        )}
      </View>

      {/* Bouton d'inscription */}
      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            הירשם
          </Text>
        )}
      </TouchableOpacity>

      {/* Lien vers la page de connexion */}
      <View style={[styles.loginContainer, styles.loginContainerRTL]}>
        <Text style={[styles.loginText, styles.textRTL]}>
          כבר יש לך חשבון?
        </Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Login', { role: 'client' })}
        >
          <Text style={[styles.loginLink, { marginRight: 5, marginLeft: 0 }]}>
            התחבר
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Rendu différent pour Web vs Mobile
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <View style={styles.webScrollContent}>
          {renderContent()}
        </View>
        <CityModalSelector
          visible={showCityModal}
          onClose={() => setShowCityModal(false)}
          onSelect={handleCitySelect}
          selectedCity={city}
        />
      </View>
    );
  }

  // ✅ FIX ANDROID: KeyboardAvoidingView ajouté — le clavier ne cache plus les champs
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="always"
        >
          {renderContent()}
        </ScrollView>
        <CityModalSelector
          visible={showCityModal}
          onClose={() => setShowCityModal(false)}
          onSelect={handleCitySelect}
          selectedCity={city}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONTAINERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Fond ultra-clair
  },
  webContainer: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#F9FAFB',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  webScrollContent: {
    padding: 20,
    paddingBottom: 200,
    maxWidth: 600,
    marginHorizontal: 'auto',
    width: '100%',
    minHeight: '100vh',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CARD PRINCIPALE (Ultra-minimaliste)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  formContainer: {
    backgroundColor: '#FFFFFF', // Blanc pur
    borderRadius: 12, // Arrondi légèrement augmenté
    padding: 24, // Padding augmenté pour respiration
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
    marginBottom: 24, // Espacement doublé
    textAlign: 'center',
    color: '#111827', // Noir profond
  },
  label: {
    fontSize: 13, // Réduit de 16px à 13px
    fontWeight: '400', // Regular
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    marginBottom: 6, // Légèrement augmenté pour respiration
    color: '#6B7280', // Gris doux
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INPUTS (Minimalistes, fond blanc, bordures subtiles)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  inputContainer: {
    marginBottom: 24, // Espacement doublé (était 15px)
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
    // ✅ FIX ANDROID: lineHeight supprimé — causait texte coupé/invisible sur Android
    // quand combiné avec height fixe. Aucun impact visuel sur iOS.
    backgroundColor: '#FFFFFF', // Blanc pur (pas #f9f9f9)
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444', // Rouge vif pour erreurs
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CITY SELECTOR (Même style que inputs)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  cityButton: {
    height: 40,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cityButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 14 * 1.4,
    color: '#111827',
    textAlign: 'right',
  },
  cityPlaceholder: {
    color: '#9CA3AF', // Gris clair pour placeholder
  },
  cityIcon: {
    marginLeft: 8,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSWORD (Container pour icône)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44, // Espace pour l'icône
  },
  passwordToggle: {
    position: 'absolute',
    left: 12,
    top: 10, // Ajusté pour hauteur 40px
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ERREURS (Textes subtils)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  errorText: {
    color: '#EF4444',
    fontSize: 11, // Réduit de 12px à 11px
    fontWeight: '400',
    letterSpacing: -0.1,
    lineHeight: 11 * 1.3,
    marginTop: 4,
  },
  generalError: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    marginBottom: 20,
    textAlign: 'center',
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
    backgroundColor: '#93C5FD', // Plus subtil (était #a5c6ef)
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
  // LOGIN LINK (Footer minimaliste)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24, // Espacement augmenté
  },
  loginContainerRTL: {
    flexDirection: 'row-reverse',
  },
  loginText: {
    color: '#6B7280', // Gris doux
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
  },
  loginLink: {
    color: '#4a90e2',
    fontSize: 13,
    fontWeight: '600', // Semibold pour lien
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    marginLeft: 5,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RTL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ClientRegistrationScreen;