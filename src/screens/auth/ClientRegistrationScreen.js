// src/screens/auth/ClientRegistrationScreen.js
// ✅ VERSION FINALE QUI MARCHE SUR EXPO WEB

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
            errors.email && styles.inputError,
            styles.textRTL
          ]}
          placeholder="example@email.com"
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
            errors.phone && styles.inputError,
            styles.textRTL
          ]}
          placeholder="05X-XXX-XXXX"
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
            size={24} 
            color="#666"
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
              size={24}
              color="#666"
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

  // Mobile (iOS/Android)
  return (
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  webContainer: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  webScrollContent: {
    padding: 20,
    paddingBottom: 200, // ⬅️ Augmente cette valeur (était 100)
    maxWidth: 600,
    marginHorizontal: 'auto',
    width: '100%',
    minHeight: '100vh', // ⬅️ Ajoute cette ligne
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  cityButton: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  cityButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
  },
  cityPlaceholder: {
    color: '#999',
  },
  cityIcon: {
    marginLeft: 10,
  },
  inputError: {
    borderColor: 'red',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    left: 15,
    top: 13,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 5,
  },
  generalError: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4a90e2',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#a5c6ef',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginContainerRTL: {
    flexDirection: 'row-reverse',
  },
  loginText: {
    color: '#666',
  },
  loginLink: {
    color: '#4a90e2',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ClientRegistrationScreen;