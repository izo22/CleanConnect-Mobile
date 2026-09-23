// src/screens/auth/LoginScreen.js — CleanCasa · bleu clair (maquette 08)
import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { palette as C } from '../../config/theme';

const LoginScreen = ({ navigation, route }) => {
  const { role = 'client' } = route.params || {};
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState(null);
  const { login, error } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }
    setIsSubmitting(true);
    try {
      await login(email, password, role);
    } catch (e) {
      Alert.alert('שגיאת התחברות', e.message || 'אימייל או סיסמה שגויים');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {navigation.canGoBack() && (
            <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-forward" size={24} color={C.ink} />
            </TouchableOpacity>
          )}

          <View style={styles.logoBox}>
            <Ionicons name="home" size={32} color={C.primary} />
          </View>
          <Text style={styles.title}>ברוכים השבים</Text>
          <Text style={styles.subtitle}>
            {role === 'provider' ? 'התחברות ספק' : 'התחברו כדי להמשיך להזמנות שלכם'}
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.label}>אימייל</Text>
          <View style={[styles.field, focused === 'email' && styles.fieldFocused]}>
            <Ionicons name="mail-outline" size={18} color={focused === 'email' ? C.primary : C.muted} />
            <TextInput
              style={styles.input}
              placeholder="name@email.com"
              placeholderTextColor={C.subtle}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
            />
          </View>

          <Text style={styles.label}>סיסמה</Text>
          <View style={[styles.field, focused === 'password' && styles.fieldFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={focused === 'password' ? C.primary : C.muted} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={C.subtle}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgot} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.link}>שכחתי סיסמה</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>התחברות</Text>}
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>אין לכם חשבון?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
              <Text style={[styles.link, { fontWeight: '600' }]}>הרשמה</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  back: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  logoBox: { alignSelf: 'flex-end', width: 60, height: 60, borderRadius: 18, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: C.ink, textAlign: 'right' },
  subtitle: { fontSize: 15, color: C.muted, textAlign: 'right', marginTop: 4, marginBottom: 24 },
  errorText: { color: C.error, fontSize: 13, textAlign: 'right', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: C.text2, textAlign: 'right', marginBottom: 6 },
  field: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 14, height: 52, marginBottom: 16 },
  fieldFocused: { backgroundColor: '#FFFFFF', borderColor: C.accent, borderWidth: 1.5 },
  input: { flex: 1, fontSize: 15, color: C.ink, textAlign: 'right', writingDirection: 'rtl' },
  forgot: { alignSelf: 'flex-end', marginBottom: 20 },
  link: { color: C.primary, fontSize: 14, fontWeight: '500' },
  button: { backgroundColor: C.primary, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  registerRow: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24 },
  registerText: { fontSize: 14, color: C.muted },
});

export default LoginScreen;
