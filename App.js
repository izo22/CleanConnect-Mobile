import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { ProviderDataProvider } from './src/context/ProviderDataContext'; // Nouveau contexte pour les données des prestataires
import AppNavigator from './src/navigation/AppNavigator';
import theme from './src/config/theme';
import { navigationRef } from './src/navigation/RootNavigation'; // Importez la référence de navigation

export default function App() {
  // Effet pour nettoyer le stockage d'authentification au démarrage
  useEffect(() => {
    const clearAuthStorage = async () => {
      console.log('Nettoyage du stockage d\'authentification...');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userData');
      console.log('Stockage nettoyé! Vous verrez maintenant l\'écran d\'inscription.');
    };
    
    // Décommentez cette ligne si vous voulez effectivement nettoyer le stockage
     clearAuthStorage();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BookingProvider>
          <ProviderDataProvider> {/* Nouveau provider pour les données des prestataires */}
            <PaperProvider theme={theme}>
              <NavigationContainer ref={navigationRef}>
                <AppNavigator />
              </NavigationContainer>
            </PaperProvider>
          </ProviderDataProvider>
        </BookingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}