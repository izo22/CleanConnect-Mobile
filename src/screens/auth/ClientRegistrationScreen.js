// src/screens/auth/ClientRegistrationScreen.js
// 🎨 VERSION ULTRA-MINIMALISTE PREMIUM
// Style inspiré de Stripe, Linear, Revolut
// ✅ AJOUT: TermsModal intégré sur le lien Terms & Conditions

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
  - Fond principal : #F6FAFD (ultra-clair)
  - formContainer : fond blanc pur #FFFFFF
  - Inputs : fond #FFFFFF (pas #F6FAFD), bordure #EEF3F7
  - Textes labels : #5E6E7C (gris doux)
  - Couleur primaire : #256FA8 conservée

✅ BOUTONS :
  - Hauteur réduite : 40px (au lieu de 50px)
  - Border-radius : 8px maintenu
  - Ombres supprimées totalement
  - État disabled plus subtil

✅ CARDS :
  - Border-radius : 12px (au lieu de 10px)
  - Bordure ultra-subtile : #EEF3F7, 1px
  - Ombres quasi-éliminées : shadowOpacity 0.03, elevation 1
  - Padding augmenté : 24px (au lieu de 20px)

✅ INPUTS :
  - Hauteur réduite : 40px (au lieu de 50px)
  - Fond blanc pur
  - Bordures ultra-légères #EEF3F7
  - Placeholder en #8A99A6

✅ SPACING :
  - Espacements doublés entre sections : 24px (au lieu de 15px)
  - Marges augmentées pour respiration
  - Pas de séparateurs visuels

✅ ICONS :
  - Taille réduite : 20px (au lieu de 24px)
  - Couleur grise douce : #8A99A6

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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import CityModalSelector from '../../components/CityModalSelector';
import TermsModal from '../../components/TermsModal'; // ✅ AJOUT

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
  const [termsAccepted, setTermsAccepted] = useState(false); // ✅ AJOUT
  const [termsVisible, setTermsVisible] = useState(false);   // ✅ AJOUT
  
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

    // ✅ AJOUT: validation acceptation CGU
    if (!termsAccepted) {
      newErrors.terms = 'עליך לקבל את התנאים וההגבלות';
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
        <Text style={[styles.label, styles.textRTL]}>שם פרטי</Text>
        <TextInput
          style={[styles.input, errors.firstName && styles.inputError, styles.textRTL]}
          placeholder="הזן את שמך הפרטי"
          placeholderTextColor="#8A99A6"
          value={firstName}
          onChangeText={setFirstName}
        />
        {errors.firstName && (
          <Text style={[styles.errorText, styles.textRTL]}>{errors.firstName}</Text>
        )}
      </View>

      {/* Nom */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>שם משפחה</Text>
        <TextInput
          style={[styles.input, errors.lastName && styles.inputError, styles.textRTL]}
          placeholder="הזן את שם המשפחה שלך"
          placeholderTextColor="#8A99A6"
          value={lastName}
          onChangeText={setLastName}
        />
        {errors.lastName && (
          <Text style={[styles.errorText, styles.textRTL]}>{errors.lastName}</Text>
        )}
      </View>

      {/* Email */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>אימייל</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="example@email.com"
          placeholderTextColor="#8A99A6"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && (
          <Text style={[styles.errorText, styles.textRTL]}>{errors.email}</Text>
        )}
      </View>

      {/* Téléphone */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>טלפון</Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          placeholder="05X-XXX-XXXX"
          placeholderTextColor="#8A99A6"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        {errors.phone && (
          <Text style={[styles.errorText, styles.textRTL]}>{errors.phone}</Text>
        )}
      </View>

      {/* Adresse */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>כתובת</Text>
        <TextInput
          style={[styles.input, errors.address && styles.inputError, styles.textRTL]}
          placeholder="רחוב ומספר בית"
          placeholderTextColor="#8A99A6"
          value={address}
          onChangeText={setAddress}
        />
        {errors.address && (
          <Text style={[styles.errorText, styles.textRTL]}>{errors.address}</Text>
        )}
      </View>

      {/* Ville */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>עיר</Text>
        <TouchableOpacity
          style={[styles.cityButton, errors.city && styles.inputError]}
          onPress={() => setShowCityModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-down" size={20} color="#8A99A6" style={styles.cityIcon} />
          <Text style={[styles.cityButtonText, !city && styles.cityPlaceholder]}>
            {city || 'בחר עיר'}
          </Text>
        </TouchableOpacity>
        {errors.city && (
          <Text style={[styles.errorText, styles.textRTL]}>{errors.city}</Text>
        )}
      </View>

      {/* Mot de passe */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>סיסמה</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, styles.passwordInput, errors.password && styles.inputError, styles.textRTL]}
            placeholder="הזן סיסמה (לפחות 6 תווים)"
            placeholderTextColor="#8A99A6"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity style={styles.passwordToggle} onPress={toggleShowPassword}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#8A99A6" />
          </TouchableOpacity>
        </View>
        {errors.password && (
          <Text style={[styles.errorText, styles.textRTL]}>{errors.password}</Text>
        )}
      </View>

      {/* Confirmation mot de passe */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, styles.textRTL]}>אימות סיסמה</Text>
        <TextInput
          style={[styles.input, errors.confirmPassword && styles.inputError, styles.textRTL]}
          placeholder="הזן את הסיסמה שוב"
          placeholderTextColor="#8A99A6"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
        />
        {errors.confirmPassword && (
          <Text style={[styles.errorText, styles.textRTL]}>{errors.confirmPassword}</Text>
        )}
      </View>

      {/* ✅ AJOUT: Terms & Conditions */}
      <View style={styles.termsContainer}>
        <Switch
          value={termsAccepted}
          onValueChange={setTermsAccepted}
          trackColor={{ false: '#E1ECF4', true: '#4CD964' }}
        />
        <Text style={[styles.termsText, styles.textRTL]}>
          אני מסכים ל
          <Text style={styles.termsLink} onPress={() => setTermsVisible(true)}>
            תנאים והגבלות
          </Text>
          {' '}ו
          <Text style={styles.termsLink} onPress={() => setTermsVisible(true)}>
            מדיניות הפרטיות
          </Text>
        </Text>
      </View>
      {errors.terms && (
        <Text style={[styles.errorText, styles.textRTL]}>{errors.terms}</Text>
      )}

      {/* Bouton inscription */}
      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>הירשם</Text>
        )}
      </TouchableOpacity>

      {/* Lien login */}
      <View style={[styles.loginContainer, styles.loginContainerRTL]}>
        <Text style={[styles.loginText, styles.textRTL]}>כבר יש לך חשבון?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login', { role: 'client' })}>
          <Text style={[styles.loginLink, { marginRight: 5, marginLeft: 0 }]}>התחבר</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Rendu Web
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
        {/* ✅ AJOUT: Modal CGU */}
        <TermsModal
          visible={termsVisible}
          onClose={() => setTermsVisible(false)}
          initialLang="he"
        />
      </View>
    );
  }

  // ✅ FIX ANDROID: KeyboardAvoidingView
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
        {/* ✅ AJOUT: Modal CGU */}
        <TermsModal
          visible={termsVisible}
          onClose={() => setTermsVisible(false)}
          initialLang="he"
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
    backgroundColor: '#F6FAFD',
  },
  webContainer: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#F6FAFD',
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
  // CARD PRINCIPALE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EEF3F7',
    shadowColor: '#1B4F7A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TYPOGRAPHIE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 18 * 1.3,
    marginBottom: 24,
    textAlign: 'center',
    color: '#1B2A36',
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    marginBottom: 6,
    color: '#5E6E7C',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INPUTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E1ECF4',
    borderRadius: 16,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    // ✅ FIX ANDROID: lineHeight supprimé — causait texte coupé/invisible sur Android
    backgroundColor: '#F4F8FB',
    color: '#1B2A36',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CITY SELECTOR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  cityButton: {
    height: 40,
    borderWidth: 1,
    borderColor: '#EEF3F7',
    borderRadius: 999,
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
    color: '#1B2A36',
    textAlign: 'right',
  },
  cityPlaceholder: {
    color: '#8A99A6',
  },
  cityIcon: {
    marginLeft: 8,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSWORD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
    backgroundColor: '#F4F8FB',
    borderColor: '#E1ECF4',
    borderWidth: 1,
    borderRadius: 16,
  },
  passwordToggle: {
    position: 'absolute',
    left: 12,
    top: 10,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ERREURS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  errorText: {
    color: '#EF4444',
    fontSize: 11,
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
  // TERMS & CONDITIONS ✅ AJOUT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  termsContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.4,
    color: '#5E6E7C',
  },
  termsLink: {
    color: '#256FA8',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BOUTON CTA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  button: {
    backgroundColor: '#256FA8',
    height: 40,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#5BA4D9',
    opacity: 0.6,
    borderRadius: 999,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 14 * 1.3,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOGIN LINK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginContainerRTL: {
    flexDirection: 'row-reverse',
  },
  loginText: {
    color: '#5E6E7C',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
  },
  loginLink: {
    color: '#256FA8',
    fontSize: 13,
    fontWeight: '600',
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