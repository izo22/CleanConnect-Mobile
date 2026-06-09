// hooks/useNotifications.js
// ✅ FIX ÉCRAN NOIR LOGOUT : setNotificationChannelAsync déplacé ici avec cancelled check

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import notificationService from '../services/notificationService';
import * as RootNavigation from '../navigation/RootNavigation';

const LOG_PREFIX = '🔔 [useNotifications]';
const log = (msg, data) => {
  if (data !== undefined) {
    console.log(`${LOG_PREFIX} ${msg}`, JSON.stringify(data));
  } else {
    console.log(`${LOG_PREFIX} ${msg}`);
  }
};
const logError = (msg, err) => {
  console.error(`${LOG_PREFIX} ❌ ${msg}`, err?.message || err);
};

export const useNotifications = (userRole) => {
  const userRoleRef = useRef(userRole);

  useEffect(() => {
    log(`userRoleRef mis à jour: ${userRole || 'NULL'}`);
    userRoleRef.current = userRole;
  }, [userRole]);

  useEffect(() => {
    log(`useEffect déclenché — userRole=${userRole || 'NULL'}`);

    if (!userRole) {
      log('⚠️ userRole est null/undefined → early return (pas de notifications)');
      return;
    }

    let cancelled = false;
    log(`▶️  initNotifications démarré pour role=${userRole}`);

    const handleNotificationReceived = (notification) => {
      log('📩 Notification reçue en premier plan', {
        title: notification?.request?.content?.title,
        body:  notification?.request?.content?.body,
      });
    };

    const handleNotificationTapped = (data) => {
      const role = userRoleRef.current;
      log('👆 Notification tappée', { type: data?.type, bookingId: data?.bookingId, role });

      const { type, bookingId } = data;

      switch (type) {
        case 'NEW_BOOKING':
          if (role === 'provider') {
            log('🧭 Navigation → Jobs > RequestsScreen');
            RootNavigation.navigate('Jobs', {
              screen: 'RequestsScreen',
              params: { highlightId: bookingId },
            });
          }
          break;
        case 'BOOKING_ACCEPTED':
          if (role === 'client') {
            log('🧭 Navigation → HomeStack > BookingDetails');
            RootNavigation.navigate('HomeStack', {
              screen: 'BookingDetails',
              params: { bookingId },
            });
          }
          break;
        case 'BOOKING_DECLINED':
          if (role === 'client') {
            log('🧭 Navigation → Dashboard');
            RootNavigation.navigate('Dashboard');
          }
          break;
        default:
          log(`⚠️ Type de notification inconnu: ${type}`);
      }
    };

    const initNotifications = async () => {
      try {
        log('📱 registerForPushNotifications...');
        const token = await notificationService.registerForPushNotifications();

        if (cancelled) {
          log('🛑 Annulé après registerForPushNotifications (logout détecté)');
          return;
        }

        if (!token) {
          log('❌ Push token non obtenu — notifications désactivées');
          return;
        }

        // ✅ FIX ÉCRAN NOIR : channel Android ici, après cancelled check
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'default',
          });
        }

        if (cancelled) {
          log('🛑 Annulé après setNotificationChannelAsync (logout détecté)');
          return;
        }

        log('✅ Push token obtenu — savePushTokenToServer...');
        const saved = await notificationService.savePushTokenToServer(token);

        if (cancelled) {
          log('🛑 Annulé après savePushTokenToServer (logout détecté)');
          return;
        }

        if (saved) {
          log('✅ Token sauvegardé — setupNotificationListeners');
          notificationService.setupNotificationListeners(
            handleNotificationReceived,
            handleNotificationTapped
          );
          log('✅ Listeners configurés');
        } else {
          log('❌ Échec sauvegarde token serveur — listeners non configurés');
        }
      } catch (e) {
        if (!cancelled) {
          logError('initNotifications', e);
        } else {
          log('⚠️ Erreur ignorée car cancelled=true', e?.message);
        }
      }
    };

    initNotifications();

    return () => {
      log(`🧹 Cleanup useNotifications — userRole=${userRole || 'NULL'} → cancelled=true`);
      cancelled = true;
      notificationService.removeNotificationListeners();
      log('✅ removeNotificationListeners appelé');
    };

  }, [userRole]);

  const clearBadge = async () => {
    log('🔴 clearBadge appelé');
    await notificationService.clearBadge();
  };

  return { clearBadge };
};