// services/notificationService.js
// ✅ Service de notifications push pour React Native avec Expo

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://cleanconnect-backend.onrender.com/api';

// Configuration du comportement des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
  }

  /**
   * Demander les permissions et obtenir le token Expo Push
   */
  async registerForPushNotifications() {
    try {
      console.log('📱 Demande des permissions de notifications...');

      // Vérifier si c'est un device physique
      if (!Device.isDevice) {
        console.log('⚠️ Les notifications push ne fonctionnent que sur un appareil physique');
        return null;
      }

      // Vérifier les permissions existantes
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Demander les permissions si pas déjà accordées
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Permission de notifications refusée');
        return null;
      }

      // Obtenir le token Expo Push
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('✅ Push token obtenu:', token.substring(0, 30) + '...');

      // Configuration Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }

      return token;

    } catch (error) {
      console.error('❌ Erreur registerForPushNotifications:', error);
      return null;
    }
  }

  /**
   * Sauvegarder le push token sur le serveur
   */
  async savePushTokenToServer(token) {
    try {
      const authToken = await AsyncStorage.getItem('token');
      
      if (!authToken) {
        console.log('⚠️ Pas de token d\'authentification');
        return false;
      }

      console.log('💾 Enregistrement du push token sur le serveur...');

      const response = await axios.post(
        `${API_URL}/notifications/token`,
        { pushToken: token },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        console.log('✅ Push token enregistré sur le serveur');
        await AsyncStorage.setItem('pushToken', token);
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Erreur savePushTokenToServer:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Supprimer le push token du serveur (lors de la déconnexion)
   */
  async removePushTokenFromServer() {
    try {
      const authToken = await AsyncStorage.getItem('token');
      
      if (!authToken) {
        return;
      }

      console.log('🗑️ Suppression du push token du serveur...');

      await axios.delete(
        `${API_URL}/notifications/token`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      await AsyncStorage.removeItem('pushToken');
      console.log('✅ Push token supprimé');

    } catch (error) {
      console.error('❌ Erreur removePushTokenFromServer:', error.response?.data || error.message);
    }
  }

  /**
   * Initialiser les listeners de notifications
   */
  setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
    // Listener pour les notifications reçues en premier plan
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification reçue:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener pour les notifications sur lesquelles l'utilisateur a appuyé
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tappée:', response);
      const data = response.notification.request.content.data;
      
      if (onNotificationTapped) {
        onNotificationTapped(data);
      }
    });
  }

  /**
   * Nettoyer les listeners
   */
  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Obtenir le nombre de notifications non lues (badge)
   */
  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Définir le nombre de badges
   */
  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Réinitialiser le badge
   */
  async clearBadge() {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Afficher une notification locale (pour les tests)
   */
  async scheduleLocalNotification(title, body, data = {}) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        badge: 1,
      },
      trigger: null, // null = immédiatement
    });
  }
}

export default new NotificationService();