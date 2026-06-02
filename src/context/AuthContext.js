// src/context/AuthContext.js
// ✅ VERSION AVEC NOTIFICATIONS PUSH INTÉGRÉES + FIX TIMING ASYNCSTORAGE + FIX VAPID WEB

import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native'; // ✅ AJOUTÉ pour détecter web
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, userService, providerService } from '../services/api';
import notificationService from '../services/notificationService';
import { useNotifications } from '../hooks/useNotifications';

// Création du contexte
export const AuthContext = createContext();

// Hook personnalisé pour utiliser le contexte d'authentification
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // États pour gérer l'authentification
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // État pour suivre si c'est le premier lancement de l'application
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);

  // ✅ NOUVEAU : Initialiser les notifications quand l'utilisateur est connecté
  useNotifications(userRole);

  // Vérifier si c'est la première fois que l'app est lancée
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const value = await AsyncStorage.getItem('alreadyLaunched');
        if (value === null) {
          await AsyncStorage.setItem('alreadyLaunched', 'true');
          setIsFirstLaunch(true);
        } else {
          setIsFirstLaunch(false);
        }
      } catch (err) {
        setIsFirstLaunch(false);
      }
    };
    
    checkFirstLaunch();
  }, []);

  // Charger les données d'authentification au démarrage
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        setIsLoading(true);
        const token = await AsyncStorage.getItem('token');
        const role = await AsyncStorage.getItem('userRole');
        const userData = await AsyncStorage.getItem('userData');
        
        console.log('📦 Bootstrap - Token existant:', token ? 'OUI' : 'NON');
        console.log('📦 Bootstrap - UserData existant:', userData ? 'OUI' : 'NON');
        
        // Auto-login désactivé selon ton code original
        console.log('⚠️ Auto-login désactivé - utilisateur doit se connecter manuellement');
      } catch (e) {
        console.error('❌ Erreur bootstrap:', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  // ✅ Fonction de connexion - AVEC INITIALISATION DES NOTIFICATIONS
  const login = async (email, password, role) => {
    setError(null);
    try {
      setIsLoading(true);
      
      console.log('🔐 Tentative de connexion:', { email, role });
      
      const credentials = { 
        email, 
        password
      };
      
      const response = await authService.login(credentials);
      
      console.log('✅ Réponse serveur login:', response);
      
      if (response.token && response.user) {
        const completeUserData = {
          ...response.user,
          city: response.user.city || '',
          address: response.user.address || '',
          phone: response.user.phone || ''
        };
        
        console.log('💾 Données utilisateur complètes à stocker:', completeUserData);
        
        // Stocker dans AsyncStorage
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('userRole', response.user.role);
        await AsyncStorage.setItem('userData', JSON.stringify(completeUserData));
        
        // ✅ FIX: Attendre que AsyncStorage persiste (important sur web)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mettre à jour l'état
        setUserToken(response.token);
        setUserInfo(completeUserData);
        setUserRole(response.user.role);
        
        console.log('✅ Connexion réussie - userInfo:', completeUserData);
        
        // ✅ FIX VAPID: Initialiser les notifications push après login (SAUF sur web)
        if (Platform.OS !== 'web') {
          setTimeout(async () => {
            console.log('📱 Initialisation des notifications post-login...');
            try {
              const token = await notificationService.registerForPushNotifications();
              if (token) {
                await notificationService.savePushTokenToServer(token);
              }
            } catch (e) {
              console.log('⚠️ Erreur notifications:', e.message);
            }
          }, 1000);
        } else {
          console.log('🌐 Web détecté - notifications push désactivées');
        }
      } else {
        throw new Error('Réponse invalide du serveur');
      }
      
      return response;
    } catch (err) {
      console.error('❌ Erreur login:', err);
      const errorMessage = err.message || 'Erreur de connexion. Veuillez réessayer.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Fonction de déconnexion - AVEC SUPPRESSION DU PUSH TOKEN
  const logout = async () => {
    setError(null);
    try {
      // ❌ SUPPRIMÉ : setIsLoading(true);
      
      console.log('🚪 Déconnexion en cours...');
      
      if (Platform.OS !== 'web') {
        try {
          await notificationService.removePushTokenFromServer();
        } catch (e) {
          console.log('⚠️ Erreur suppression push token (ignorée):', e.message);
        }
      }
      
      try {
        await authService.logout();
      } catch (serviceError) {
        console.log('⚠️ Erreur backend lors de la déconnexion (ignorée):', serviceError);
      }
      
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userData');
      
      // Ces 3 setState déclenchent le re-render vers AuthStack directement
      setUserToken(null);
      setUserInfo(null);
      setUserRole(null);
      
      console.log('✅ Déconnexion réussie');
      
      return { success: true };
    } catch (err) {
      console.error('❌ Erreur déconnexion:', err);
      const errorMessage = err.message || 'Erreur lors de la déconnexion';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
    // ❌ SUPPRIMÉ : finally { setIsLoading(false); }
  };

  // ✅ Inscription d'un client - AVEC INITIALISATION DES NOTIFICATIONS
  const registerClient = async (userData) => {
    setError(null);
    try {
      setIsLoading(true);
      
      console.log('📝 Inscription client avec données:', userData);
      console.log('📍 Ville envoyée:', userData.city);
      
      const response = await authService.registerClient(userData);
      
      console.log('✅ Réponse serveur inscription:', response);
      
      if (response.token && response.user) {
        const completeUserData = {
          ...response.user,
          address: userData.address || response.user.address,
          phone: userData.phone || response.user.phone,
          city: userData.city || response.user.city
        };
        
        console.log('💾 Données complètes à stocker:', completeUserData);
        
        // Stocker dans AsyncStorage
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('userRole', 'client');
        await AsyncStorage.setItem('userData', JSON.stringify(completeUserData));
        
        // ✅ FIX: Attendre que AsyncStorage persiste (important sur web)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Mettre à jour l'état
        setUserToken(response.token);
        setUserInfo(completeUserData);
        setUserRole('client');
        
        console.log('✅ Inscription réussie - userInfo:', completeUserData);
        
        // ✅ FIX VAPID: Initialiser les notifications push après inscription (SAUF sur web)
        if (Platform.OS !== 'web') {
          setTimeout(async () => {
            console.log('📱 Initialisation des notifications post-inscription...');
            try {
              const token = await notificationService.registerForPushNotifications();
              if (token) {
                await notificationService.savePushTokenToServer(token);
              }
            } catch (e) {
              console.log('⚠️ Erreur notifications:', e.message);
            }
          }, 1000);
        } else {
          console.log('🌐 Web détecté - notifications push désactivées');
        }
      } else {
        throw new Error('Réponse invalide du serveur');
      }
      
      return response;
    } catch (err) {
      console.error('❌ Erreur inscription:', err);
      const errorMessage = err.message || 'Erreur lors de l\'inscription. Veuillez réessayer.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Inscription d'un prestataire - AVEC INITIALISATION DES NOTIFICATIONS + FIX TIMING
  const registerProvider = async (providerData) => {
    setError(null);
    try {
      setIsLoading(true);
      
      console.log('📝 Inscription prestataire avec données:', providerData);
      
      const response = await authService.registerProvider(providerData);
      
      console.log('✅ Réponse serveur inscription prestataire:', response);
      
      if (response.token) {
        // Stocker dans AsyncStorage
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('userRole', 'provider');
        await AsyncStorage.setItem('userData', JSON.stringify(response.provider));
        
        // ✅ FIX CRITIQUE: Attendre que AsyncStorage persiste (crucial sur web)
        // Sans ce délai, le token n'est pas encore disponible quand ProviderDashboardScreen charge
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Mettre à jour l'état APRÈS que AsyncStorage ait persisté
        setUserToken(response.token);
        setUserInfo(response.provider);
        setUserRole('provider');
        
        console.log('✅ Inscription prestataire réussie - Token stocké et states mis à jour');
        
        // ✅ FIX VAPID: Initialiser les notifications push après inscription (SAUF sur web)
        if (Platform.OS !== 'web') {
          setTimeout(async () => {
            console.log('📱 Initialisation des notifications post-inscription...');
            try {
              const token = await notificationService.registerForPushNotifications();
              if (token) {
                await notificationService.savePushTokenToServer(token);
              }
            } catch (e) {
              console.log('⚠️ Erreur notifications:', e.message);
            }
          }, 1000);
        } else {
          console.log('🌐 Web détecté - notifications push désactivées');
        }
      }
      
      return response;
    } catch (err) {
      console.error('❌ Erreur inscription prestataire:', err);
      const errorMessage = err.message || 'Erreur lors de l\'inscription du prestataire. Veuillez réessayer.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Mettre à jour les informations utilisateur
  const updateUserInfo = async (updatedData) => {
    setError(null);
    try {
      setIsLoading(true);
      let response;
      
      console.log('🔄 Mise à jour userInfo avec:', updatedData);
      
      if (userRole === 'provider') {
        response = await providerService.updateProfile(updatedData);
      } else {
        response = await userService.updateProfile(updatedData);
      }
      
      const updatedUserInfo = { ...userInfo, ...updatedData };
      setUserInfo(updatedUserInfo);
      
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUserInfo));
      
      console.log('✅ Mise à jour userInfo réussie:', updatedUserInfo);
      
      return response;
    } catch (err) {
      console.error('❌ Erreur mise à jour userInfo:', err);
      const errorMessage = err.message || 'Erreur lors de la mise à jour du profil';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Changer le mot de passe utilisateur
  const changePassword = async (currentPassword, newPassword) => {
    setError(null);
    try {
      setIsLoading(true);
      const response = await authService.changePassword({
        currentPassword,
        newPassword
      });
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Erreur lors du changement de mot de passe';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Demande de réinitialisation de mot de passe
  const forgotPassword = async (email) => {
    setError(null);
    try {
      setIsLoading(true);
      const response = await authService.forgotPassword({ email });
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Erreur lors de la demande de réinitialisation du mot de passe';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Réinitialisation du mot de passe avec un token
  const resetPassword = async (token, newPassword) => {
    setError(null);
    try {
      setIsLoading(true);
      const response = await authService.resetPassword({ token, newPassword });
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Erreur lors de la réinitialisation du mot de passe';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Vérifier l'authenticité du token actuel
  const checkAuthStatus = async () => {
    setIsRefreshing(true);
    try {
      const response = await authService.getMe();
      setUserInfo(response.data);
      setIsRefreshing(false);
      return true;
    } catch (err) {
      if (err.status === 401) {
        await logout();
      }
      setIsRefreshing(false);
      return false;
    }
  };

  // Mise à jour du token (refresh token functionality)
  const refreshToken = async () => {
    try {
      const response = await authService.refreshToken();
      if (response.token) {
        setUserToken(response.token);
        await AsyncStorage.setItem('token', response.token);
      }
      return response;
    } catch (err) {
      if (err.status === 401) {
        await logout();
      }
      throw err;
    }
  };

  // Valeur du contexte exposée aux composants
  const authContext = {
    isLoading,
    isRefreshing,
    userToken,
    userInfo,
    userRole,
    error,
    isFirstLaunch,
    setIsFirstLaunch,
    setUserToken,
    setUserInfo,
    setUserRole,
    login,
    logout,
    registerClient,
    registerProvider,
    updateUserInfo,
    changePassword,
    forgotPassword,
    resetPassword,
    checkAuthStatus,
    refreshToken,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;