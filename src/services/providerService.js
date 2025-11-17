// src/services/providerService.js
// ✅ FIX: Extraire data de la réponse backend

import { API_URL } from '../config/constants';

const providerService = {
  /**
   * Récupérer tous les prestataires
   */
  getAllProviders: async () => {
    try {
      
      const response = await fetch(`${API_URL}/providers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });


      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      // ✅ FIX: Extraire le tableau 'data' de la réponse
      const data = result.data || result;
      
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Récupérer un prestataire par son ID
   */
  getProviderById: async (providerId) => {
    try {
      
      const response = await fetch(`${API_URL}/providers/${providerId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data || result;
      
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Rechercher des prestataires par ville
   */
  searchProvidersByCity: async (city) => {
    try {
      
      const response = await fetch(`${API_URL}/providers/search?city=${encodeURIComponent(city)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data || result;
      
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Rechercher des prestataires par type de service
   */
  searchProvidersByService: async (serviceType) => {
    try {
      
      const response = await fetch(`${API_URL}/providers/search?serviceType=${encodeURIComponent(serviceType)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data || result;
      
      
      return data;
    } catch (error) {
      throw error;
    }
  },
};

export default providerService;
