import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { ProviderDataProvider } from './src/context/ProviderDataContext';
import AppNavigator from './src/navigation/AppNavigator';
import theme from './src/config/theme';
import { navigationRef } from './src/navigation/RootNavigation';

export default function App() {
  // Effet pour nettoyer le stockage d'authentification au démarrage
  useEffect(() => {
    const clearAuthStorage = async () => {
      try {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('userRole');
        await AsyncStorage.removeItem('userData');
      } catch (error) {
        // Erreur silencieuse - ne pas crasher l'app
      }
    };
    
    // Décommentez cette ligne si vous voulez effectivement nettoyer le stockage
    // clearAuthStorage();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BookingProvider>
          <ProviderDataProvider>
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