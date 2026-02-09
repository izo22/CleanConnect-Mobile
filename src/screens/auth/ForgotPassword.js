// src/screens/auth/ForgotPassword.js
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';

const ForgotPasswordScreen = ({ navigation }) => {
  const isRTL = true;
  const [email, setEmail] = React.useState('');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, styles.textRTL]}>
        שכחת סיסמה?
      </Text>
      <Text style={[styles.subtitle, styles.textRTL]}>
        הזן את כתובת האימייל שלך ונשלח לך הוראות לאיפוס הסיסמה
      </Text>
      
      <TextInput
        label="אימייל"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        style={[styles.input, styles.textRTL]}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <Button 
        mode="contained" 
        onPress={() => alert('נשלחה בקשה לאיפוס סיסמה')}
        style={styles.button}
      >
        שלח בקשה לאיפוס
      </Button>
      
      <Button 
        mode="text" 
        onPress={() => navigation.navigate('Login')}
        style={styles.linkButton}
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    marginBottom: 20,
  },
  button: {
    marginTop: 10,
  },
  linkButton: {
    marginTop: 20,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ForgotPasswordScreen;
