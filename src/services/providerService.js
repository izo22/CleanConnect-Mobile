// src/services/providerService.js
import { API_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper centralisé — évite la répétition dans chaque méthode
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('token');
  if (!token) console.warn('[providerService] ⚠️ Aucun token trouvé dans AsyncStorage');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const providerService = {

  getAllProviders: async (city, serviceType) => {
    try {
      const params = new URLSearchParams();
      if (city)        params.append('city', city);
      if (serviceType) params.append('serviceType', serviceType);

      const query = params.toString();
      const url   = `${API_URL}/providers${query ? `?${query}` : ''}`;

      // ── DIAGNOSTIC (à retirer après validation) ──────────
      console.log('[getAllProviders] URL :', url);
      console.log('[getAllProviders] city reçu :', city);
      console.log('[getAllProviders] serviceType reçu :', serviceType);
      // ─────────────────────────────────────────────────────

      const headers  = await getAuthHeaders();
      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[getAllProviders] HTTP ${response.status} :`, body);
        throw new Error(`שגיאת HTTP: ${response.status}`);
      }

      const result = await response.json();

      // ── DIAGNOSTIC ───────────────────────────────────────
      console.log('[getAllProviders] Résultat brut :', JSON.stringify(result, null, 2));
      // ─────────────────────────────────────────────────────

      return result.data ?? result;
    } catch (error) {
      console.error('[getAllProviders] Erreur :', error.message);
      throw error;
    }
  },

  getProviderById: async (providerId) => {
    try {
      const headers  = await getAuthHeaders();
      const response = await fetch(`${API_URL}/providers/${providerId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) throw new Error(`שגיאת HTTP: ${response.status}`);

      const result = await response.json();
      return result.data ?? result;
    } catch (error) {
      console.error('[getProviderById] Erreur :', error.message);
      throw error;
    }
  },

  searchProvidersByCity: async (city) => {
    try {
      const headers  = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/providers/search?city=${encodeURIComponent(city)}`,
        { method: 'GET', headers }
      );

      if (!response.ok) throw new Error(`שגיאת HTTP: ${response.status}`);

      const result = await response.json();
      return result.data ?? result;
    } catch (error) {
      console.error('[searchProvidersByCity] Erreur :', error.message);
      throw error;
    }
  },

  searchProvidersByService: async (serviceType) => {
    try {
      const headers  = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/providers/search?serviceType=${encodeURIComponent(serviceType)}`,
        { method: 'GET', headers }
      );

      if (!response.ok) throw new Error(`שגיאת HTTP: ${response.status}`);

      const result = await response.json();
      return result.data ?? result;
    } catch (error) {
      console.error('[searchProvidersByService] Erreur :', error.message);
      throw error;
    }
  },
};

export default providerService;