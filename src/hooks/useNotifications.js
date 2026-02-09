// hooks/useNotifications.js
// ✅ Hook personnalisé pour gérer les notifications push - VERSION CLEANCONNECT

import { useEffect, useCallback } from 'react';
import notificationService from '../services/notificationService';
import * as RootNavigation from '../navigation/RootNavigation';

export const useNotifications = (userRole) => {
  // Gérer les notifications reçues en premier plan
  const handleNotificationReceived = useCallback((notification) => {
    console.log('🔔 Notification reçue:', notification.request.content);
    
    // La notification s'affichera automatiquement avec le son et le badge
    // Optionnel : ajouter ici un toast ou une alerte personnalisée
    
  }, []);

  // Gérer le tap sur une notification
  const handleNotificationTapped = useCallback((data) => {
    console.log('👆 Notification tappée, navigation vers:', data);
    
    const { type, bookingId } = data;
    
    // Navigation selon le type de notification et le rôle
    switch (type) {
      case 'NEW_BOOKING':
        // Prestataire reçoit une nouvelle demande
        if (userRole === 'provider') {
          // Naviguer vers l'écran des demandes
          RootNavigation.navigate('Jobs', {
            screen: 'RequestsScreen',
            params: { highlightId: bookingId }
          });
        }
        break;
        
      case 'BOOKING_ACCEPTED':
        // Client - réservation acceptée
        if (userRole === 'client') {
          // Naviguer vers les détails de la réservation
          RootNavigation.navigate('HomeStack', {
            screen: 'BookingDetails',
            params: { bookingId }
          });
        }
        break;
        
      case 'BOOKING_DECLINED':
        // Client - réservation refusée
        if (userRole === 'client') {
          // Naviguer vers le dashboard des réservations
          RootNavigation.navigate('Dashboard');
        }
        break;
        
      default:
        console.log('Type de notification inconnu:', type);
    }
    
  }, [userRole]);

  // Initialiser les notifications au montage
  useEffect(() => {
    // Ne rien faire si pas de rôle (pas connecté)
    if (!userRole) {
      console.log('⚠️ Pas de rôle utilisateur - notifications non initialisées');
      return;
    }

    const initNotifications = async () => {
      console.log('🚀 Initialisation des notifications pour:', userRole);
      
      // 1. Obtenir le token
      const token = await notificationService.registerForPushNotifications();
      
      if (token) {
        // 2. Sauvegarder sur le serveur
        const saved = await notificationService.savePushTokenToServer(token);
        
        if (saved) {
          console.log('✅ Notifications activées avec succès');
          
          // 3. Configurer les listeners
          notificationService.setupNotificationListeners(
            handleNotificationReceived,
            handleNotificationTapped
          );
        } else {
          console.log('❌ Échec de la sauvegarde du token sur le serveur');
        }
      } else {
        console.log('❌ Impossible d\'obtenir le push token');
      }
    };

    initNotifications();

    // Cleanup
    return () => {
      notificationService.removeNotificationListeners();
    };
  }, [userRole, handleNotificationReceived, handleNotificationTapped]);

  // Fonction pour réinitialiser le badge
  const clearBadge = useCallback(async () => {
    await notificationService.clearBadge();
  }, []);

  return {
    clearBadge
  };
};