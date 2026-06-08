// hooks/useNotifications.js
// ✅ Hook personnalisé pour gérer les notifications push - VERSION CLEANCONNECT
// ✅ FIX ÉCRAN NOIR : flag cancelled pour annuler l'async en cours au démontage

import { useEffect, useCallback } from 'react';
import notificationService from '../services/notificationService';
import * as RootNavigation from '../navigation/RootNavigation';

export const useNotifications = (userRole) => {
  // Gérer les notifications reçues en premier plan
  const handleNotificationReceived = useCallback((notification) => {
    console.log('🔔 Notification reçue:', notification.request.content);
  }, []);

  // Gérer le tap sur une notification
  const handleNotificationTapped = useCallback((data) => {
    console.log('👆 Notification tappée, navigation vers:', data);
    
    const { type, bookingId } = data;
    
    switch (type) {
      case 'NEW_BOOKING':
        if (userRole === 'provider') {
          RootNavigation.navigate('Jobs', {
            screen: 'RequestsScreen',
            params: { highlightId: bookingId }
          });
        }
        break;
        
      case 'BOOKING_ACCEPTED':
        if (userRole === 'client') {
          RootNavigation.navigate('HomeStack', {
            screen: 'BookingDetails',
            params: { bookingId }
          });
        }
        break;
        
      case 'BOOKING_DECLINED':
        if (userRole === 'client') {
          RootNavigation.navigate('Dashboard');
        }
        break;
        
      default:
        console.log('Type de notification inconnu:', type);
    }
    
  }, [userRole]);

  // Initialiser les notifications au montage
  useEffect(() => {
    if (!userRole) {
      console.log('⚠️ Pas de rôle utilisateur - notifications non initialisées');
      return;
    }

    let cancelled = false; // ✅ FIX : flag pour annuler l'async si userRole passe à null

    const initNotifications = async () => {
      console.log('🚀 Initialisation des notifications pour:', userRole);
      
      const token = await notificationService.registerForPushNotifications();
      if (cancelled) return; // ✅ stop si déconnexion en cours
      
      if (token) {
        const saved = await notificationService.savePushTokenToServer(token);
        if (cancelled) return; // ✅ stop si déconnexion en cours
        
        if (saved) {
          console.log('✅ Notifications activées avec succès');
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

    return () => {
      cancelled = true; // ✅ annule tout async encore en cours
      notificationService.removeNotificationListeners();
    };
  }, [userRole, handleNotificationReceived, handleNotificationTapped]);

  const clearBadge = useCallback(async () => {
    await notificationService.clearBadge();
  }, []);

  return {
    clearBadge
  };
};