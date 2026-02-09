// src/services/providerService.js
// ✅ תורגם לעברית ללא i18n

import { API_URL } from '../config/constants';

const providerService = {
  /**
   * לקבל את כל הספקים
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
        throw new Error(`שגיאת HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      // ✅ FIX: חילוץ המערך 'data' מהתגובה
      const data = result.data || result;
      
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * לקבל ספק לפי מזהה
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
        throw new Error(`שגיאת HTTP: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data || result;
      
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * חיפוש ספקים לפי עיר
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
        throw new Error(`שגיאת HTTP: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data || result;
      
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * חיפוש ספקים לפי סוג שירות
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
        throw new Error(`שגיאת HTTP: ${response.status}`);
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