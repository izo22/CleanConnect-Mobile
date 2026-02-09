// ProviderDashboardScreen.js
// ✅ VERSION AVEC RECHARGEMENT AUTOMATIQUE quand on revient sur l'écran
// ✅ FILTRE: Affiche uniquement les missions du jour en cours

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Pressable } from 'react-native';
import { Card, Badge } from 'react-native-paper';
import { providerService } from '../../services/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const ProviderDashboardScreen = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const navigation = useNavigation();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthError, setIsAuthError] = useState(false); // ✅ Flag pour erreurs 403

  const CustomButton = ({ title, onPress, mode = 'contained', icon }) => (
    <TouchableOpacity 
      style={[styles.btnBase, mode === 'contained' ? styles.btnContained : styles.btnOutlined]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon && <Icon name={icon} size={20} color={mode === 'contained' ? '#fff' : '#0066CC'} style={styles.btnIcon} />}
      <Text style={mode === 'contained' ? styles.btnTextContained : styles.btnTextOutlined}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const CardHeader = ({ title }) => (
    <View style={styles.cardHeader}>
      <Text style={[styles.cardTitle, isRTL && styles.textRTL]}>
        {title}
      </Text>
    </View>
  );

  const getStatusInHebrew = (status) => {
    const normalizedStatus = status?.toLowerCase().trim().replace(/\s+/g, '_');
    const statusMap = {
      'pending': 'ממתין לאישור',
      'pending_status': 'ממתין לאישור',
      'pending_payment': 'ממתין לאישור',
      'accepted': 'מאושר',
      'confirmed': 'מאושר',
      'completed': 'הושלם',
      'cancelled': 'בוטל',
      'canceled': 'בוטל',
      'payment_pending': 'ממתין לאישור',
      'payment_held': 'תשלום מוחזק',
      'payment_released': 'תשלום שוחרר',
      'in_progress': 'בתהליך',
      'awaiting_payment': 'ממתין לאישור',
      'declined': 'נדחה',
      'expired': 'פג תוקף'
    };
    return statusMap[normalizedStatus] || status;
  };

  const getStatusColor = (status) => {
    const normalizedStatus = status?.toLowerCase().trim().replace(/\s+/g, '_');
    const colorMap = {
      'pending': '#FF9800',
      'pending_payment': '#FF9800',
      'accepted': '#4CAF50',
      'confirmed': '#4CAF50',
      'completed': '#2196F3',
      'cancelled': '#F44336',
      'canceled': '#F44336',
      'declined': '#F44336',
      'expired': '#9E9E9E'
    };
    return colorMap[normalizedStatus] || '#757575';
  };

  const getServiceTypeLabel = (serviceType) => {
    const serviceMap = {
      'Standard Cleaning': 'ניקיון רגיל',
      'standard': 'ניקיון רגיל',
      'Deep Cleaning': 'ניקיון עמוק',
      'deep': 'ניקיון עמוק',
      'Move In/Out': 'ניקיון דירה',
      'move': 'ניקיון דירה',
      'Post Construction': 'ניקיון אחרי בנייה',
      'construction': 'ניקיון אחרי בנייה',
      'Window Cleaning': 'ניקיון חלונות',
      'windows': 'ניקיון חלונות',
      'home': 'בית',
      'Home': 'בית',
      'office': 'משרד',
      'Office': 'משרד',
      'building': 'בניין',
      'Building': 'בניין',
      'airbnb': 'אירבנב',
      'Airbnb': 'אירבנב',
      'בית': 'בית',
      'משרד': 'משרד',
      'בניין': 'בניין',
      'אירבנב': 'אירבנב'
    };
    return serviceMap[serviceType] || serviceType;
  };

  // ✅ Fonction de chargement des données (extraite pour réutilisation)
  const fetchProviderData = useCallback(async () => {
    // ✅ Ne pas retry si on a déjà une erreur d'auth
    if (isAuthError) {
      console.log('❌ Erreur d\'authentification détectée, arrêt du chargement');
      return;
    }

    try {
      setLoading(true);

      let token = await AsyncStorage.getItem('token');
      let retries = 0;
      const MAX_RETRIES = 3; // ✅ Réduit de 10 à 3
      
      while (!token && retries < MAX_RETRIES) {
        console.log(`⏳ Token pas encore disponible, retry ${retries + 1}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, 200));
        token = await AsyncStorage.getItem('token');
        retries++;
      }
      
      if (!token) {
        console.error('❌ Token non disponible après', MAX_RETRIES, 'tentatives');
        setIsAuthError(true);
        await AsyncStorage.clear();
        navigation.replace('Login');
        return;
      }
      
      console.log('✅ Token récupéré, chargement du dashboard optimisé...');
      
      // ✅ OPTIMISATION: Appels parallèles pour récupérer uniquement ce qui est nécessaire
      const [profileResponse, statsResponse, todayJobsResponse] = await Promise.all([
        providerService.getProviderProfile(),
        providerService.getDashboardStats(),
        providerService.getTodayJobs()
      ]);
      
      let providerData = profileResponse.data || profileResponse.provider || profileResponse;
      
      // Stats du dashboard
      const stats = statsResponse.data || {};
      console.log(`✅ Stats: ${stats.pendingCount} pending, ${stats.completedCount} completed`);
      
      // Missions du jour uniquement
      const todayBookings = todayJobsResponse.data || [];
      console.log(`✅ ${todayBookings.length} missions pour aujourd'hui`);
      
      // Formater les missions du jour pour l'affichage
      providerData.requests = todayBookings.map(req => ({
        id: req._id,
        status: req.status,
        serviceType: req.serviceType,
        date: req.scheduledDate,
        clientName: req.client ? `${req.client.firstName} ${req.client.lastName}` : 'Client inconnu',
        price: req.price,
        address: req.address,
        description: req.description,
        payment: req.payment
      }));
      
      // Ajouter les stats au provider
      providerData.stats = stats;
      
      setProvider(providerData);
      setLoading(false);
      setError(null); // ✅ Reset error on success
      console.log('✅ Dashboard chargé avec succès (optimisé)');
    } catch (err) {
      console.error('❌ Erreur chargement profil:', err);
      
      // ✅ NOUVEAU : Détecter les erreurs 403 spécifiquement
      if (err.response?.status === 403 || err.message?.includes('403')) {
        console.error('🔒 Erreur 403 - Session expirée, redirection vers login...');
        setIsAuthError(true);
        await AsyncStorage.clear();
        // ✅ Redirection immédiate sans possibilité de retry
        navigation.replace('Login');
        return;
      }
      
      setError('שגיאה בטעינת הפרופיל');
      setLoading(false);
    }
  }, [isAuthError, navigation]); // ✅ Ajout de isAuthError et navigation aux dépendances

  // ✅ Chargement initial
  useEffect(() => {
    fetchProviderData();
  }, [fetchProviderData]);

  // ✅ NOUVEAU : Rechargement automatique quand on revient sur cet écran
  // ⚠️ Mais PAS si on a une erreur d'authentification
  useFocusEffect(
    useCallback(() => {
      if (!isAuthError) {
        console.log('🔄 Dashboard focus - Rechargement des données...');
        fetchProviderData();
      } else {
        console.log('⚠️ Erreur d\'auth détectée, pas de rechargement');
      }
    }, [fetchProviderData, isAuthError])
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={[styles.loadingText, isRTL && styles.textRTL]}>טוען...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={50} color="#FF6B6B" />
        <Text style={[styles.errorText, isRTL && styles.textRTL]}>{error}</Text>
        
        {/* ✅ Boutons différents selon le type d'erreur */}
        {!isAuthError ? (
          <View style={{ gap: 12 }}>
            <CustomButton 
              title="נסה שוב"
              onPress={fetchProviderData}
              mode="contained"
              icon="refresh"
            />
            <CustomButton 
              title="חזור"
              onPress={() => navigation.goBack()}
              mode="outlined"
              icon="arrow-back"
            />
          </View>
        ) : (
          <CustomButton 
            title="התחבר מחדש"
            onPress={() => navigation.replace('Login')}
            mode="contained"
            icon="login"
          />
        )}
      </View>
    );
  }

  const pendingRequests = provider?.stats?.pendingCount || 0;
  const completedJobs = provider?.stats?.completedCount || 0;

  const formatServices = () => {
    if (provider?.serviceDetails && Array.isArray(provider.serviceDetails) && provider.serviceDetails.length > 0) {
      return provider.serviceDetails.map(service => (
        `${getServiceTypeLabel(service.type)}: ${service.hourlyRate}₪/שעה`
      )).join(', ');
    }
    
    if (provider?.serviceTypes && Array.isArray(provider.serviceTypes) && provider.serviceTypes.length > 0) {
      return provider.serviceTypes.map(type => getServiceTypeLabel(type)).join(', ');
    }
    
    return 'לא צוין';
  };

  const getAverageRate = () => {
    if (provider?.serviceDetails && Array.isArray(provider.serviceDetails) && provider.serviceDetails.length > 0) {
      const sum = provider.serviceDetails.reduce((total, service) => total + service.hourlyRate, 0);
      const avg = sum / provider.serviceDetails.length;
      return Math.round(avg * 100) / 100;
    }
    return 0;
  };

  // ✅ Les missions du jour sont déjà filtrées par le backend
  const todayRequests = provider?.requests || [];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <Text style={[styles.name, isRTL && styles.textRTL]}>
            {provider?.companyName || `${provider?.firstName} ${provider?.lastName}`}
          </Text>
        </View>

        {/* Carte des statistiques */}
        <Card style={styles.card}>
          <CardHeader title="לוח בקרה" />
          <Card.Content>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pendingRequests}</Text>
                <Text style={[styles.statLabel, isRTL && styles.textRTL]}>
                  בקשות ממתינות
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedJobs}</Text>
                <Text style={[styles.statLabel, isRTL && styles.textRTL]}>
                  שירותים שהושלמו
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{getAverageRate()}₪</Text>
                <Text style={[styles.statLabel, isRTL && styles.textRTL]}>
                  תעריף ממוצע
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Informations du prestataire */}
        <Card style={styles.card}>
          <CardHeader title="המידע שלי" />
          <Card.Content>
            <View style={[styles.infoRow, isRTL && styles.infoRowRTL]}>
              <Text style={[styles.infoLabel, isRTL && styles.textRTL]}>
                אימייל
              </Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.infoValue, isRTL && styles.textRTL]}>
                {provider?.email}
              </Text>
            </View>
            
            <View style={[styles.infoRow, isRTL && styles.infoRowRTL]}>
              <Text style={[styles.infoLabel, isRTL && styles.textRTL]}>
                טלפון
              </Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.infoValue, isRTL && styles.textRTL]}>
                {provider?.phone || 'לא צוין'}
              </Text>
            </View>
            
            <View style={[styles.infoRow, isRTL && styles.infoRowRTL]}>
              <Text style={[styles.infoLabel, isRTL && styles.textRTL]}>
                סוגי שירות
              </Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.infoValue, isRTL && styles.textRTL]}>
                {formatServices()}
              </Text>
            </View>
            
            <View style={[styles.infoRow, isRTL && styles.infoRowRTL]}>
              <Text style={[styles.infoLabel, isRTL && styles.textRTL]}>
                אזורי שירות
              </Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.infoValue, isRTL && styles.textRTL]}>
                {provider?.serviceAreas?.join(', ') || 'לא צוין'}
              </Text>
            </View>
          </Card.Content>
          <View style={styles.actionPadding}>
            <CustomButton 
              title="ערוך פרופיל"
              onPress={() => navigation.navigate('Profile', { 
                screen: 'EditPersonalInfo',
                params: { provider: provider }
              })}
              mode="outlined"
              icon="edit"
            />
          </View>
        </Card>

        {/* Dernières demandes - UNIQUEMENT DU JOUR */}
        <Card style={styles.card}>
          <CardHeader title="בקשות להיום" />
          <Card.Content>
            {todayRequests.length > 0 ? (
              <View style={styles.requestsGrid}>
                {todayRequests.slice(0, 3).map((request, index) => (
                  <Pressable 
                    key={request.id || index}
                    style={({ pressed }) => [
                      styles.modernRequestCard,
                      pressed && styles.modernRequestCardPressed
                    ]}
                    onPress={() => navigation.navigate('Jobs', { 
                      screen: 'RequestsScreen',
                      params: { selectedRequest: request.id }
                    })}
                  >
                    <View style={styles.modernRequestHeader}>
                      <View style={styles.modernRequestClient}>
                        <Icon name="person" size={20} color="#0066CC" />
                        <Text style={[styles.modernClientName, isRTL && styles.textRTL]}>
                          {request.clientName}
                        </Text>
                      </View>
                      <View style={[styles.modernStatusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                        <Text style={styles.modernStatusText}>
                          {getStatusInHebrew(request.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.serviceTypeContainer}>
                      <Icon name="cleaning-services" size={22} color="#0066CC" />
                      <Text style={[styles.serviceTypeText, isRTL && styles.textRTL]}>
                        {getServiceTypeLabel(request.serviceType)}
                      </Text>
                    </View>

                    <View style={styles.modernPriceRow}>
                      <Icon name="payments" size={20} color="#4CAF50" />
                      <Text style={styles.modernPriceText}>
                        {request.price}₪
                      </Text>
                    </View>

                    <View style={styles.addressContainer}>
                      <Icon name="location-on" size={18} color="#FF9800" />
                      <Text style={[styles.addressText, isRTL && styles.textRTL]} numberOfLines={2}>
                        {request.address || 'כתובת לא סופקה'}
                      </Text>
                    </View>

                    <View style={styles.modernRequestFooter}>
                      <Icon name="event" size={16} color="#999" />
                      <Text style={[styles.modernDateText, isRTL && styles.textRTL]}>
                        {request.date ? format(new Date(request.date), 'PPP', { locale: he }) : ''}
                      </Text>
                    </View>

                    <View style={styles.modernArrowIcon}>
                      <Icon name="chevron-left" size={24} color="#0066CC" />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Icon name="inbox" size={60} color="#DDD" />
                <Text style={[styles.noRequestsText, isRTL && styles.textRTL]}>
                  אין משימות להיום
                </Text>
              </View>
            )}
          </Card.Content>
          
          {todayRequests.length > 0 && (
            <View style={styles.actionPadding}>
              <CustomButton 
                title="צפה בכל הבקשות"
                onPress={() => navigation.navigate('Jobs', { screen: 'RequestsScreen' })}
                mode="outlined"
                icon="list"
              />
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginVertical: 10,
    color: '#FF6B6B',
    textAlign: 'center',
    fontSize: 16,
  },
  header: {
    marginBottom: 20,
    paddingVertical: 10,
  },
  headerRTL: {
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  card: {
    marginBottom: 16,
    elevation: 3,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  infoRowRTL: {
    flexDirection: 'row-reverse',
  },
  infoLabel: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  colon: {
    marginHorizontal: 4,
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  requestsGrid: {
    gap: 12,
  },
  modernRequestCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modernRequestCardPressed: {
    backgroundColor: '#E3F2FD',
    borderColor: '#0066CC',
    elevation: 4,
  },
  modernRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modernRequestClient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modernClientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  modernStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 1,
  },
  modernStatusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  serviceTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  serviceTypeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0066CC',
    textAlign: 'right',
  },
  modernPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  modernPriceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF9E6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  addressText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  modernRequestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  modernDateText: {
    fontSize: 13,
    color: '#999',
  },
  modernArrowIcon: {
    position: 'absolute',
    left: 16,
    top: '50%',
    marginTop: -12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noRequestsText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 12,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  actionPadding: {
    padding: 16,
  },
  btnBase: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  btnContained: {
    backgroundColor: '#0066CC',
  },
  btnOutlined: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#0066CC',
    elevation: 2,
  },
  btnIcon: {
    marginRight: 8,
  },
  btnTextContained: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnTextOutlined: {
    color: '#0066CC',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default ProviderDashboardScreen;