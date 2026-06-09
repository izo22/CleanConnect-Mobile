// hooks/useNotifications.js
// ✅ VERSION DEBUG ÉCRAN NOIR — logs détaillés + fix double-trigger useCallback

import { useEffect, useRef } from 'react';
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
  // ✅ Ref pour lire userRole sans en faire une dépendance du useEffect
  const userRoleRef = useRef(userRole);

  // Sync de la ref à chaque changement de userRole
  useEffect(() => {
    log(`userRoleRef mis à jour: ${userRole || 'NULL'}`);
    userRoleRef.current = userRole;
  }, [userRole]);

  // ── Effect principal ─────────────────────────────────────────────────────
  useEffect(() => {
    log(`useEffect déclenché — userRole=${userRole || 'NULL'}`);

    if (!userRole) {
      log('⚠️ userRole est null/undefined → early return (pas de notifications)');
      return;
    }

    let cancelled = false;
    log(`▶️  initNotifications démarré pour role=${userRole}`);

    // ── Handlers définis DANS le useEffect → pas de dépendance externe ─────
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

    // ── Init async ───────────────────────────────────────────────────────
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

    // ── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      log(`🧹 Cleanup useNotifications — userRole=${userRole || 'NULL'} → cancelled=true`);
      cancelled = true;
      notificationService.removeNotificationListeners();
      log('✅ removeNotificationListeners appelé');
    };

  }, [userRole]); // ✅ userRole UNIQUEMENT — plus de double-trigger

  // ── clearBadge ───────────────────────────────────────────────────────────
  const clearBadge = async () => {
    log('🔴 clearBadge appelé');
    await notificationService.clearBadge();
  };

  return { clearBadge };
};