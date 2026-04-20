// App.js - VERSION SANS i18n

import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
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
  
  useEffect(() => {
    const clearAuthStorage = async () => {
      try {
        console.log('✅ Données d\'authentification nettoyées (si activé)');
      } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
      }
    };
    clearAuthStorage();
  }, []);

  useEffect(() => {
    I18nManager.allowRTL(true);
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