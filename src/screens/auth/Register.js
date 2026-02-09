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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    width: '100%',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default RegisterScreen;
