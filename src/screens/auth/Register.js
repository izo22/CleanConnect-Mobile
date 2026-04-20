// src/screens/auth/Register.js
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';

const RegisterScreen = ({ navigation }) => {
  const isRTL = true;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, styles.textRTL]}>
        הרשמה
      </Text>
      <Text style={[styles.subtitle, styles.textRTL]}>
        בפיתוח...
      </Text>
      
      <Button 
        mode="contained" 
        onPress={() => navigation.navigate('Login')}
        style={styles.button}
        labelStyle={styles.buttonLabel}
      >
        חזרה להתחברות
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 18 * 1.3,
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 14 * 1.4,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    width: '100%',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 14 * 1.3,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default RegisterScreen;