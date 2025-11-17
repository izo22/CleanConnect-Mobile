// src/navigation/AuthNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from 'react-native-paper';

// Import des écrans d'authentification
// Note: Ces composants seront créés dans les étapes suivantes
import LoginScreen from '../screens/auth/Login';
import RegisterScreen from '../screens/auth/Register';
import ForgotPasswordScreen from '../screens/auth/ForgotPassword';
import RoleSelectionScreen from '../screens/auth/RoleSelection';
import ProviderSignupScreen from '../screens/auth/ProviderSignup';
import ClientSignupScreen from '../screens/auth/ClientSignup';
import VerificationScreen from '../screens/auth/Verification';

// Création de la pile de navigation pour l'authentification
const Stack = createStackNavigator();

/**
 * Navigateur pour la partie authentification de l'application.
 * Gère la pile des écrans de connexion, inscription, etc.
 */
const AuthNavigator = () => {
  const theme = useTheme();

  // Configuration des options de l'en-tête pour toutes les écrans
  const screenOptions = {
    headerStyle: {
      backgroundColor: theme.colors.primary,
      elevation: 0, // Supprime l'ombre sous l'en-tête sur Android
      shadowOpacity: 0, // Supprime l'ombre sous l'en-tête sur iOS
    },
    headerTintColor: '#fff', // Couleur du texte et des icônes de l'en-tête
    headerTitleStyle: {
      fontWeight: 'bold',
    },
  };

  return (
    <Stack.Navigator 
      initialRouteName="Login"
      screenOptions={screenOptions}
    >
      {/* Écran de connexion - sans en-tête pour un design épuré */}
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ headerShown: false }}
      />
      
      {/* Écran d'inscription - première étape avec sélection de rôle */}
      <Stack.Screen 
        name="RoleSelection" 
        component={RoleSelectionScreen} 
        options={{ title: "Type d'utilisateur" }}
      />
      
      {/* Écran d'inscription pour les prestataires */}
      <Stack.Screen 
        name="ProviderSignup" 
        component={ProviderSignupScreen} 
        options={{ title: "Inscription prestataire" }}
      />
      
      {/* Écran d'inscription pour les clients */}
      <Stack.Screen 
        name="ClientSignup" 
        component={ClientSignupScreen} 
        options={{ title: "Inscription client" }}
      />
      
      {/* Écran de vérification (email, téléphone, etc.) */}
      <Stack.Screen 
        name="Verification" 
        component={VerificationScreen} 
        options={{ title: "Vérification" }}
      />
      
      {/* Écran pour le formulaire d'inscription général (obsolète mais gardé pour compatibilité) */}
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen} 
        options={{ title: "Inscription" }}
      />
      
      {/* Écran de récupération de mot de passe */}
      <Stack.Screen 
        name="ForgotPassword" 
        component={ForgotPasswordScreen} 
        options={{ title: "Mot de passe oublié" }}
      />
    </Stack.Navigator>
  );
};
