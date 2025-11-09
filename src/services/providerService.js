// src/services/providerService.js
// ✅ FIX: Extraire data de la réponse backend

import { API_URL } from '../config/constants';

const providerService = {
  /**
   * Récupérer tous les prestataires
   */
  getAllProviders: async () => {
    try {
      console.log('📡 Appel API: GET /providers');
      
      const response = await fetch(`${API_URL}/providers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Réponse API:', response.status);

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      // ✅ FIX: Extraire le tableau 'data' de la réponse
      const data = result.data || result;
      
      console.log(`✅ ${data.length} prestataires récupérés`);
      
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des prestataires:', error);
      throw error;
    }
  },

  /**
   * Récupérer un prestataire par son ID
   */
  getProviderById: async (providerId) => {
    try {
      console.log('📡 Appel API: GET /providers/' + providerId);
      
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
      
      console.log('✅ Prestataire récupéré:', data.firstName, data.lastName);
      
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du prestataire:', error);
      throw error;
    }
  },

  /**
   * Rechercher des prestataires par ville
   */
  searchProvidersByCity: async (city) => {
    try {
      console.log('📡 Recherche prestataires pour la ville:', city);
      
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
      
      console.log(`✅ ${data.length} prestataires trouvés pour ${city}`);
      
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de la recherche de prestataires:', error);
      throw error;
    }
  },

  /**
   * Rechercher des prestataires par type de service
   */
  searchProvidersByService: async (serviceType) => {
    try {
      console.log('📡 Recherche prestataires pour le service:', serviceType);
      
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
      
      console.log(`✅ ${data.length} prestataires trouvés pour ${serviceType}`);
      
      return data;
    } catch (error) {
      console.error('❌ Erreur lors de la recherche de prestataires:', error);
      throw error;
    }
  },
};

export default providerService;