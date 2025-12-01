// App.js
// ✅ VERSION AVEC i18n INTÉGRÉ

// ⚠️ IMPORTANT : Importer i18n.config EN PREMIER
import './i18n.config';

import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { ProviderDataProvider } from './src/context/ProviderDataContext';
import { LanguageProvider } from './src/context/LanguageContext'; // ✅ NOUVEAU
import AppNavigator from './src/navigation/AppNavigator';
import theme from './src/config/theme';
import { navigationRef } from './src/navigation/RootNavigation';

export default function App() {
  // ✅ OPTION DE RESET POUR LES TESTS
  // Décommentez la ligne ci-dessous pour effacer toutes les données au démarrage
  // IMPORTANT : Remettez en commentaire après avoir testé !
  
  useEffect(() => {
    const clearAuthStorage = async () => {
      try {
        // ⚠️ DÉCOMMENTEZ CETTE LIGNE POUR RÉINITIALISER L'APP
        // await AsyncStorage.clear();
        
        // OU pour nettoyer uniquement les données d'authentification :
        // await AsyncStorage.removeItem('token');
        // await AsyncStorage.removeItem('userRole');
        // await AsyncStorage.removeItem('userData');
        
        console.log('✅ Données d\'authentification nettoyées (si activé)');
      } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
      }
    };
    
    // Appeler la fonction au démarrage
    clearAuthStorage();
  }, []);

  // ✅ NOUVEAU : Activer le support RTL pour l'hébreu
  useEffect(() => {
    I18nManager.allowRTL(true);
  }, []);

  return (
    <SafeAreaProvider>
      {/* ✅ NOUVEAU : LanguageProvider doit entourer TOUT */}
      <LanguageProvider>
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
      </LanguageProvider>
    </SafeAreaProvider>
  );
}