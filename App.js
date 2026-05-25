// App.js - VERSION SANS i18n

import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, I18nManager } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { ProviderDataProvider } from './src/context/ProviderDataContext';
import AppNavigator from './src/navigation/AppNavigator';
import theme from './src/config/theme';
import { navigationRef } from './src/navigation/RootNavigation';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('✅ Données d\'authentification nettoyées (si activé)');
        I18nManager.allowRTL(true);
        await SplashScreen.hideAsync();
        setTimeout(() => setIsReady(true), 1500);
      } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
        setIsReady(true);
      }
    };
    init();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('./assets/icon.png')}
          style={styles.logo}
        />
        <Text style={styles.title}>CLEANCO</Text>
        <Text style={styles.subtitle}>שירותי ניקיון מקצועיים</Text>
      </View>
    );
  }

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

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#2D8FEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
});