// App.js - VERSION SANS i18n
// ✅ FIX ÉCRAN NOIR LOGOUT : key sur NavigationContainer (remount complet)
// ✅ DEBUG : ErrorBoundary → affiche le crash JS à l'écran au lieu de l'écran noir

import React, { useEffect, useState, useContext } from 'react';
import { View, Image, Text, StyleSheet, I18nManager, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { ProviderDataProvider } from './src/context/ProviderDataContext';
import AppNavigator from './src/navigation/AppNavigator';
import theme from './src/config/theme';
import { navigationRef } from './src/navigation/RootNavigation';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

SplashScreen.preventAutoHideAsync();

// ── ErrorBoundary : transforme l'écran noir en message d'erreur lisible ──────
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('💥 [ErrorBoundary] Crash capturé:', error?.message);
    console.error('💥 [ErrorBoundary] Component stack:', info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
          contentContainerStyle={{ padding: 24, paddingTop: 80 }}
        >
          <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            💥 CRASH DÉTECTÉ
          </Text>
          <Text style={{ color: '#111827', fontSize: 13, marginBottom: 16 }}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
          <Text style={{ color: '#6B7280', fontSize: 10, fontFamily: 'monospace' }}>
            {String(this.state.error?.stack || '').slice(0, 1500)}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

// ✅ Composant interne : consomme AuthContext pour piloter le key du container.
const RootNavigation = () => {
  const { userToken } = useContext(AuthContext);

  return (
    <NavigationContainer
      ref={navigationRef}
      key={userToken ? 'app' : 'auth'}
    >
      <AppNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('✅ Chargement des fonts...');
        await Font.loadAsync(Ionicons.font);
        console.log('✅ Fonts chargées');
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
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <BookingProvider>
            <ProviderDataProvider>
              <PaperProvider theme={theme}>
                <RootNavigation />
              </PaperProvider>
            </ProviderDataProvider>
          </BookingProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
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