// provider/RequestsScreen.js
// ✅ AVEC ADRESSE VISIBLE + CORRECTION ACCEPTATION/REFUS

import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { providerService } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RequestsScreen = ({ navigation }) => {
  const { userInfo } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequests, setProcessingRequests] = useState({});

  useFocusEffect(
    React.useCallback(() => {
      loadRequests();
    }, [])
  );

  // ✅ Fonction pour formater l'adresse
  const formatAddress = (address) => {
    if (!address) return 'כתובת לא סופקה';
    
    if (typeof address === 'string') {
      return address;
    }
    
    if (address.fullAddress) {
      return address.fullAddress;
    }
    
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.houseNumber) parts.push(address.houseNumber);
    if (address.city) parts.push(address.city);
    
    return parts.length > 0 ? parts.join(', ') : 'כתובת לא סופקה';
  };

  const loadRequests = async () => {
    try {
      const response = await providerService.getProviderProfile();
      const providerId = response.data._id;
      
      if (!providerId) {
        setLoading(false);
        return;
      }

      const jobsResponse = await providerService.getJobs();
      const apiRequests = jobsResponse.data || [];
      
      console.log(`✅ ${apiRequests.length} missions récupérées depuis l'API`);
      
      const formattedRequests = apiRequests.map(req => ({
        _id: req._id,
        status: req.status,
        serviceType: req.serviceType,
        dateTime: req.scheduledDate,
        duration: req.duration || 2,
        clientName: req.client ? `${req.client.firstName} ${req.client.lastName}` : 'Client inconnu',
        clientId: req.client?._id,
        clientPhone: req.client?.phone,
        price: req.price,
        address: req.address,
        notes: req.notes,
        payment: req.payment
      }));
      
      setRequests(formattedRequests);
      
      const providerRequestsKey = `provider_requests_${providerId}`;
      await AsyncStorage.setItem(providerRequestsKey, JSON.stringify(formattedRequests));
      
    } catch (error) {
      console.error('Erreur chargement requêtes:', error);
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'pending': 'ממתין לאישור',
      'pending_payment': 'ממתין לאישור',
      'payment_pending': 'ממתין לאישור',
      'accepted': 'מאושר',
      'confirmed': 'מאושר',
      'completed': 'הושלם',
      'declined': 'נדחה',
      'cancelled': 'בוטל',
      'canceled': 'בוטל',
      'payment_held': 'תשלום מוחזק',
      'payment_released': 'תשלום שוחרר',
      'in_progress': 'בתהליך'
    };
    return statusMap[status] || status;
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
      'Airbnb': 'אירבנב'
    };
    return serviceMap[serviceType] || serviceType;
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      const daysHebrew = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      const monthsHebrew = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      
      const dayOfWeek = daysHebrew[date.getDay()];
      const dayOfMonth = date.getDate();
      const month = monthsHebrew[date.getMonth()];
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${dayOfWeek}, ${dayOfMonth} ${month}, ${hours}:${minutes}`;
    } catch (error) {
      console.error('Erreur formatage date:', error);
      return dateString;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'pending_payment':
      case 'payment_pending':
        return '#FF9800';
      case 'accepted':
      case 'confirmed':
        return '#4CAF50';
      case 'declined':
      case 'cancelled':
      case 'canceled':
        return '#F44336';
      case 'completed':
        return '#9C27B0';
      default:
        return '#666666';
    }
  };

  // ✅ CORRECTION - Utilise le service API
  const acceptRequest = async (requestId) => {
    try {
      if (processingRequests[requestId]) return;
      
      setProcessingRequests(prev => ({ ...prev, [requestId]: true }));

      // ✅ DEBUG: Vérifier le rôle et le token
      const userRole = await AsyncStorage.getItem('userRole');
      const token = await AsyncStorage.getItem('token');
      console.log('🔑 Rôle utilisateur:', userRole);
      console.log('🎫 Token présent:', !!token);

      // ✅ Utilise la fonction du service API
      const data = await providerService.acceptJob(requestId);

      if (!data.success) {
        throw new Error(data.message || 'שגיאה באישור הבקשה');
      }

      await updateRequestStatus(requestId, 'accepted');
      await loadRequests();

      Alert.alert(
        'הצלחה!',
        'הבקשה אושרה והתשלום נלקח. הלקוח יקבל את מספר הטלפון שלך.',
        [{ text: 'אישור' }]
      );

    } catch (error) {
      console.error('Erreur acceptation:', error);
      Alert.alert(
        'שגיאה',
        error.message || 'לא ניתן לאשר את הבקשה',
        [{ text: 'אישור' }]
      );
    } finally {
      setProcessingRequests(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // ✅ CORRECTION - Utilise le service API
  const declineRequest = async (requestId) => {
    try {
      if (processingRequests[requestId]) return;

      Alert.prompt(
        'סיבת דחייה',
        'למה אתה דוחה את הבקשה הזו?',
        [
          {
            text: 'ביטול',
            style: 'cancel'
          },
          {
            text: 'שלח',
            onPress: async (reason) => {
              try {
                setProcessingRequests(prev => ({ ...prev, [requestId]: true }));

                // ✅ DEBUG: Vérifier le rôle et le token
                const userRole = await AsyncStorage.getItem('userRole');
                const token = await AsyncStorage.getItem('token');
                console.log('🔑 Rôle utilisateur:', userRole);
                console.log('🎫 Token présent:', !!token);

                // ✅ Utilise la fonction du service API
                const data = await providerService.declineJob(requestId);

                if (!data.success) {
                  throw new Error(data.message || 'שגיאה בדחיית הבקשה');
                }

                await updateRequestStatus(requestId, 'declined');
                await loadRequests();

                Alert.alert(
                  'בקשה נדחתה',
                  'הלקוח יקבל החזר כספי אוטומטי.',
                  [{ text: 'אישור' }]
                );

              } catch (error) {
                console.error('Erreur refus:', error);
                Alert.alert(
                  'שגיאה',
                  error.message || 'לא ניתן לדחות את הבקשה',
                  [{ text: 'אישור' }]
                );
              } finally {
                setProcessingRequests(prev => ({ ...prev, [requestId]: false }));
              }
            }
          }
        ],
        'plain-text',
        '',
        'default'
      );

    } catch (error) {
      console.error('Erreur flux refus:', error);
    }
  };

  const updateRequestStatus = async (requestId, newStatus) => {
    try {
      const response = await providerService.getProviderProfile();
      const providerId = response.data._id;
      
      if (!providerId) return;

      const providerRequestsKey = `provider_requests_${providerId}`;
      const savedRequests = await AsyncStorage.getItem(providerRequestsKey);
      
      if (savedRequests) {
        const requestsData = JSON.parse(savedRequests);
        const updatedRequests = requestsData.map(req => 
          req._id === requestId ? { ...req, status: newStatus } : req
        );
        await AsyncStorage.setItem(providerRequestsKey, JSON.stringify(updatedRequests));
      }

      const request = requests.find(r => r._id === requestId);
      if (request) {
        await syncStatusToClient(request.clientId, requestId, newStatus);
      }

    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
    }
  };

  const syncStatusToClient = async (clientId, requestId, newStatus) => {
    try {
      const clientBookingsKey = 'user_bookings';
      const savedBookings = await AsyncStorage.getItem(clientBookingsKey);
      
      if (savedBookings) {
        const bookingsData = JSON.parse(savedBookings);
        const updatedBookings = bookingsData.map(booking => 
          booking._id === requestId ? { ...booking, status: newStatus } : booking
        );
        await AsyncStorage.setItem(clientBookingsKey, JSON.stringify(updatedBookings));
      }
    } catch (error) {
      console.error('Erreur sync client:', error);
    }
  };

  const navigateToDetails = (request) => {
    const jobData = {
      id: request._id,
      clientName: request.clientName,
      serviceName: getServiceTypeLabel(request.serviceType),
      date: request.dateTime,
      duration: request.duration,
      address: formatAddress(request.address),
      coordinates: {
        latitude: 32.0853,
        longitude: 34.7818
      },
      clientPhone: request.clientPhone || '+972 50 123 4567',
      price: request.price,
      status: request.status,
      notes: request.notes || 'אין הערות',
      payment: request.payment
    };

    navigation.navigate('JobDetails', { 
      jobId: request._id,
      jobData: jobData 
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>טוען...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>המשימות שלי</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={60} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>אין בקשות</Text>
            <Text style={styles.emptySubtitle}>בקשות חדשות יופיעו כאן</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {requests.filter(r => r.status === 'pending' || r.status === 'pending_payment').length}
                </Text>
                <Text style={styles.statLabel}>ממתין</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {requests.filter(r => r.status === 'accepted' || r.status === 'confirmed').length}
                </Text>
                <Text style={styles.statLabel}>מאושר</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {requests.filter(r => r.status === 'completed').length}
                </Text>
                <Text style={styles.statLabel}>הושלם</Text>
              </View>
            </View>

            {requests.map((request) => (
              <TouchableOpacity
                key={request._id}
                style={styles.requestCard}
                onPress={() => navigateToDetails(request)}
                activeOpacity={0.7}
              >
                <View style={styles.requestHeader}>
                  <Text style={styles.clientName}>{request.clientName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                    <Text style={styles.statusText}>
                      {getStatusLabel(request.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.serviceTypeContainer}>
                  <Ionicons name="construct" size={22} color="#007AFF" />
                  <Text style={styles.serviceTypeText}>
                    {getServiceTypeLabel(request.serviceType)}
                  </Text>
                </View>

                <View style={styles.requestInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar" size={16} color="#666666" />
                    <Text style={styles.infoText}>
                      {formatDate(request.dateTime)}
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="time" size={16} color="#666666" />
                    <Text style={styles.infoText}>{request.duration} שעות</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="cash" size={16} color="#4CAF50" />
                    <Text style={[styles.infoText, { color: '#4CAF50', fontWeight: 'bold' }]}>
                      ₪{request.price}
                    </Text>
                  </View>
                </View>

                {/* ✅ ADRESSE BIEN VISIBLE */}
                <View style={styles.addressRow}>
                  <Ionicons name="location" size={20} color="#FF9800" />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {formatAddress(request.address)}
                  </Text>
                </View>

                {(request.status === 'pending' || request.status === 'pending_payment') && (
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={[
                        styles.acceptButton,
                        processingRequests[request._id] && styles.disabledButton
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        acceptRequest(request._id);
                      }}
                      disabled={processingRequests[request._id]}
                    >
                      {processingRequests[request._id] ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.acceptButtonText}>קבל</Text>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.declineButton,
                        processingRequests[request._id] && styles.disabledButton
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        declineRequest(request._id);
                      }}
                      disabled={processingRequests[request._id]}
                    >
                      <Text style={styles.declineButtonText}>דחה</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  loadingText: {
    marginTop: 10,
    color: '#666666',
    textAlign: 'right',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
  },
  refreshButton: {
    padding: 5,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666666',
    marginTop: 20,
    textAlign: 'right',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginTop: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    borderRadius: 10,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  requestHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  serviceTypeContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  serviceTypeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginRight: 8,
    textAlign: 'right',
  },
  requestInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginLeft: 15,
    marginBottom: 5,
    width: '45%',
  },
  infoText: {
    fontSize: 14,
    color: '#333333',
    marginRight: 5,
    textAlign: 'right',
  },
  // ✅ ADRESSE SUPER VISIBLE
  addressRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  addressText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    marginRight: 10,
    flex: 1,
    textAlign: 'right',
    lineHeight: 22,
  },
  pendingActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 0.48,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#F44336',
    flex: 0.48,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#F44336',
    fontWeight: 'bold',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default RequestsScreen;