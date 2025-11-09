import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = React.useState('');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mot de passe oublié</Text>
      <Text style={styles.subtitle}>Entrez votre email pour réinitialiser votre mot de passe</Text>
      
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <Button 
        mode="contained" 
        onPress={() => alert('Réinitialisation demandée')}
        style={styles.button}
      >
        Réinitialiser
      </Button>
      
      <Button 
        mode="text" 
        onPress={() => navigation.navigate('Login')}
        style={styles.linkButton}
      >
        Retour à la connexion
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
});

export default ForgotPasswordScreen;