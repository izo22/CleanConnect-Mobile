// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, userService, providerService } from '../services/api';
import { Platform } from 'react-native';

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
        // Erreur silencieuse
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
        
        if (token && userData) {
          setUserToken(token);
          setUserRole(role);
          setUserInfo(JSON.parse(userData));
          
          // ✅ NE PAS vérifier le token au démarrage - ça crash si le serveur est lent
          // La vérification se fera quand l'utilisateur fait une action qui nécessite l'API
        }
      } catch (e) {
        // Erreur silencieuse - on continue simplement sans authentification
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  // Fonction de connexion modifiée pour ne pas envoyer le rôle
  const login = async (email, password, role) => {
    setError(null);
    try {
      setIsLoading(true);
      
      // Ne pas inclure le rôle dans les credentials envoyés au backend
      const credentials = { 
        email, 
        password
      };
      
      const response = await authService.login(credentials);
      
      if (response.token) {
        // Stocker dans AsyncStorage
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('userRole', response.user.role);
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        
        // Mettre à jour l'état
        setUserToken(response.token);
        setUserInfo(response.user);
        setUserRole(response.user.role);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Erreur de connexion. Veuillez réessayer.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction de déconnexion améliorée
  const logout = async () => {
    setError(null);
    try {
      setIsLoading(true);
      
      // Tenter d'appeler le service de déconnexion
      try {
        await authService.logout();
      } catch (serviceError) {
        // Continuer malgré l'erreur
      }
      
      // Nettoyer le stockage local
      await AsyncStorage.clear();
      
      // Réinitialiser les états
      setUserToken(null);
      setUserInfo(null);
      setUserRole(null);
      
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || 'Erreur lors de la déconnexion';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Inscription d'un client
  const registerClient = async (userData) => {
    setError(null);
    try {
      setIsLoading(true);
      
      const response = await authService.registerClient(userData);
      
      if (response.token) {
        // Merger les données envoyées avec les données reçues
        const completeUserData = {
          ...response.user,
          address: userData.address,
          phone: userData.phone
        };
        
        // Stocker dans AsyncStorage
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('userRole', 'client');
        await AsyncStorage.setItem('userData', JSON.stringify(completeUserData));
        
        // Mettre à jour l'état
        setUserToken(response.token);
        setUserInfo(completeUserData);
        setUserRole('client');
      }
      
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Erreur lors de l\'inscription. Veuillez réessayer.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Inscription d'un prestataire
  const registerProvider = async (providerData) => {
    setError(null);
    try {
      setIsLoading(true);
      const response = await authService.registerProvider(providerData);
      
      if (response.token) {
        // Stocker dans AsyncStorage
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('userRole', 'provider');
        await AsyncStorage.setItem('userData', JSON.stringify(response.provider));
        
        // Mettre à jour l'état
        setUserToken(response.token);
        setUserInfo(response.provider);
        setUserRole('provider');
      }
      
      return response;
    } catch (err) {
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
      
      // Utiliser le service approprié selon le rôle de l'utilisateur
      if (userRole === 'provider') {
        response = await providerService.updateProfile(updatedData);
      } else {
        response = await userService.updateProfile(updatedData);
      }
      
      // Mettre à jour l'état local
      const updatedUserInfo = { ...userInfo, ...updatedData };
      setUserInfo(updatedUserInfo);
      
      // Mettre à jour le stockage local
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUserInfo));
      
      return response;
    } catch (err) {
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