// services/providerAvailabilityService.js
// ✅ Service pour gérer les disponibilités du prestataire avec synchronisation backend

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/constants';

class ProviderAvailabilityService {
  /**
   * Récupérer les disponibilités depuis le backend
   */
  async fetchAvailabilities() {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token non disponible');
      }

      console.log('📥 Récupération des disponibilités depuis le backend...');

      const response = await fetch(`${API_URL}/providers/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la récupération');
      }

      const availabilities = data.data?.availability || [];
      console.log(`✅ ${availabilities.length} disponibilités récupérées`);

      return {
        success: true,
        data: availabilities
      };

    } catch (error) {
      console.error('❌ Erreur fetchAvailabilities:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Sauvegarder les disponibilités sur le backend
   */
  async saveAvailabilities(availabilities) {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token non disponible');
      }

      console.log('💾 Sauvegarde des disponibilités sur le backend...');
      console.log('   Nombre:', availabilities.length);

      const response = await fetch(`${API_URL}/providers/availability`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          availability: availabilities
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la sauvegarde');
      }

      console.log('✅ Disponibilités sauvegardées sur le backend');

      return {
        success: true,
        data: data.data
      };

    } catch (error) {
      console.error('❌ Erreur saveAvailabilities:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Ajouter une disponibilité (locale + backend)
   */
  async addAvailability(currentAvailabilities, newAvailability) {
    try {
      const updatedAvailabilities = [...currentAvailabilities, newAvailability];
      
      // Sauvegarder sur le backend
      const result = await this.saveAvailabilities(updatedAvailabilities);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      console.log('✅ Disponibilité ajoutée avec succès');

      return {
        success: true,
        data: updatedAvailabilities
      };

    } catch (error) {
      console.error('❌ Erreur addAvailability:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Supprimer une disponibilité (locale + backend)
   */
  async deleteAvailability(currentAvailabilities, availabilityId) {
    try {
      const updatedAvailabilities = currentAvailabilities.filter(
        av => av.id !== availabilityId
      );
      
      // Sauvegarder sur le backend
      const result = await this.saveAvailabilities(updatedAvailabilities);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      console.log('✅ Disponibilité supprimée avec succès');

      return {
        success: true,
        data: updatedAvailabilities
      };

    } catch (error) {
      console.error('❌ Erreur deleteAvailability:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

export default new ProviderAvailabilityService();