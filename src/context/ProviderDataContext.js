// src/context/ProviderDataContext.js
import React, { createContext, useState, useContext } from 'react';
import api from '../services/api'; // Utiliser l'instance api configurée
import { useAuth } from './AuthContext';

// Création du contexte
const ProviderDataContext = createContext();

// Custom hook pour utiliser le contexte
export const useProviderData = () => useContext(ProviderDataContext);

export const ProviderDataProvider = ({ children }) => {
  const { token } = useAuth();
  const [providers, setProviders] = useState([]);
  const [currentProvider, setCurrentProvider] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Récupérer la liste des prestataires (avec filtres optionnels)
  const getProviders = async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const { serviceType, serviceArea, minRating } = filters;
      let queryParams = '';
      
      if (serviceType || serviceArea || minRating) {
        queryParams = '?';
        if (serviceType) queryParams += `serviceType=${serviceType}&`;
        if (serviceArea) queryParams += `serviceArea=${serviceArea}&`;
        if (minRating) queryParams += `minRating=${minRating}&`;
        
        // Supprimer le dernier & s'il existe
        queryParams = queryParams.endsWith('&') 
          ? queryParams.slice(0, -1) 
          : queryParams;
      }
      
      // Utiliser l'instance api au lieu d'axios direct
      const response = await api.get(`/public/providers${queryParams}`);
      
      if (response.data.success) {
        setProviders(response.data.data);
        setLoading(false);
        return response.data.data;
      } else {
        setError('Erreur lors de la récupération des prestataires');
        setLoading(false);
        return [];
      }
      
    } catch (error) {
      setError('Erreur lors de la récupération des prestataires: ' + error.message);
      setLoading(false);
      throw error;
    }
  };

  // Récupérer les détails d'un prestataire spécifique
  const getProviderDetails = async (providerId) => {
    try {
      setLoading(true);
      setError(null);
      
      // Utiliser l'instance api - URL corrigée
      const response = await api.get(`/public/providers/${providerId}`);
      
      if (response.data.success) {
        setCurrentProvider(response.data.data);
      } else {
        setError('Erreur lors de la récupération des détails du prestataire');
      }
      
      setLoading(false);
      return response.data.data;
    } catch (error) {
      setError('Erreur lors de la récupération des détails du prestataire: ' + error.message);
      setLoading(false);
      throw error;
    }
  };

  // Soumettre un avis sur un prestataire
  const submitReview = async (providerId, reviewData) => {
    try {
      setLoading(true);
      setError(null);
      
      // Utiliser l'instance api - elle gère automatiquement les headers Authorization
      const response = await api.post(`/public/providers/${providerId}/reviews`, reviewData);
      
      if (response.data.success) {
        // Mettre à jour le prestataire actuel avec le nouvel avis
        if (currentProvider && currentProvider._id === providerId) {
          getProviderDetails(providerId);
        }
      } else {
        setError('Erreur lors de la soumission de l\'avis');
      }
      
      setLoading(false);
      return response.data;
    } catch (error) {
      setError('Erreur lors de la soumission de l\'avis: ' + error.message);
      setLoading(false);
      throw error;
    }
  };

  // Récupérer le profil du prestataire connecté
  const getProviderProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Utiliser l'instance api - URL corrigée sans /api en double
      const response = await api.get('/providers/profile');
      
      if (response.data.success) {
        setCurrentProvider(response.data.data);
      } else {
        setError('Erreur lors de la récupération du profil prestataire');
      }
      
      setLoading(false);
      return response.data.data;
    } catch (error) {
      setError('Erreur lors de la récupération du profil prestataire: ' + error.message);
      setLoading(false);
      throw error;
    }
  };

  // Mettre à jour le profil du prestataire
  const updateProviderProfile = async (profileData) => {
    try {
      setLoading(true);
      setError(null);
      
      // Utiliser l'instance api - URL corrigée
      const response = await api.put('/providers/profile', profileData);
      
      if (response.data.success) {
        setCurrentProvider(response.data.data);
      } else {
        setError('Erreur lors de la mise à jour du profil');
      }
      
      setLoading(false);
      return response.data;
    } catch (error) {
      setError('Erreur lors de la mise à jour du profil: ' + error.message);
      setLoading(false);
      throw error;
    }
  };

  // Valeur du contexte exposée aux composants
  const value = {
    providers,
    currentProvider,
    loading,
    error,
    getProviders,
    getProviderDetails,
    submitReview,
    getProviderProfile,
    updateProviderProfile
  };

  return (
    <ProviderDataContext.Provider value={value}>
      {children}
    </ProviderDataContext.Provider>
  );
};
