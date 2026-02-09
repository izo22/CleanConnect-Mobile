// src/screens/auth/LoginScreen.js
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
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.textRTL, { paddingLeft: 50 }]}
              placeholder="סיסמה"
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
                size={24}
                color="#666"
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
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
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
    position: 'relative',
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
  passwordToggle: {
    position: 'absolute',
    right: 15,
    top: 13,
  },
  passwordToggleRTL: {
    right: 'auto',
    left: 15,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordRTL: {
    alignSelf: 'flex-start',
  },
  forgotPasswordText: {
    color: '#4a90e2',
    fontSize: 14,
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerContainerRTL: {
    flexDirection: 'row-reverse',
  },
  registerText: {
    color: '#666',
  },
  registerLink: {
    color: '#4a90e2',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default LoginScreen;
