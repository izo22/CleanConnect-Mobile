// JobListScreen.js - Version complètement en hébreu
// ✅ Affiche TOUTES les demandes (pending, accepted, completed)
// ✅ Tout traduit en hébreu (dates incluses)

import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const JobListScreen = ({ navigation }) => {
  const { userInfo } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequests, setProcessingRequests] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('הכל');

  useFocusEffect(
    React.useCallback(() => {
      loadRequests();
    }, [])
  );

  const loadRequests = async () => {
    try {
      const response = await providerService.getProviderProfile();
      const providerId = response.data._id;
      
      if (!providerId) {
        setLoading(false);
        return;
      }

      const providerRequestsKey = `provider_requests_${providerId}`;
      const savedRequests = await AsyncStorage.getItem(providerRequestsKey);
      
      if (savedRequests) {
        const requestsData = JSON.parse(savedRequests);
        setRequests(requestsData);
        setFilteredRequests(requestsData);
      } else {
        setRequests([]);
        setFilteredRequests([]);
      }
    } catch (error) {
      console.error('Erreur chargement requêtes:', error);
      setRequests([]);
      setFilteredRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  // ✅ Traduction des statuts
  const getStatusLabel = (status) => {
    const statusMap = {
      'pending': 'ממתין',
      'pending_payment': 'ממתין לתשלום',
      'payment_pending': 'ממתין לתשלום',
      'accepted': 'מאושר',
      'confirmed': 'מאושר',
      'completed': 'הושלם',
      'declined': 'נדחה',
      'cancelled': 'בוטל',
      'canceled': 'בוטל',
    };
    return statusMap[status] || status;
  };

  // ✅ Traduction des types de service
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
      'airbnb': 'אירבנב',  // ✅ NOUVEAU
      'Airbnb': 'אירבנב'   // ✅ NOUVEAU
    };
    return serviceMap[serviceType] || serviceType;
  };

  // ✅ Formatage de date en hébreu (méthode manuelle pour garantir l'hébreu)
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      // Jours de la semaine en hébreu
      const daysHebrew = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      
      // Mois en hébreu
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

  // ✅ Filtres
  const applyFilters = (filter) => {
    setActiveFilter(filter);
    
    let filtered = [...requests];
    
    if (filter === 'ממתין') {
      filtered = requests.filter(r => r.status === 'pending' || r.status === 'pending_payment');
    } else if (filter === 'מאושר') {
      filtered = requests.filter(r => r.status === 'accepted' || r.status === 'confirmed');
    } else if (filter === 'הושלם') {
      filtered = requests.filter(r => r.status === 'completed');
    }
    
    // Appliquer la recherche si nécessaire
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        req =>
          req.clientName?.toLowerCase().includes(query) ||
          req.address?.fullAddress?.toLowerCase().includes(query) ||
          getServiceTypeLabel(req.serviceType).toLowerCase().includes(query)
      );
    }
    
    setFilteredRequests(filtered);
  };

  // ✅ Recherche
  const handleSearch = (text) => {
    setSearchQuery(text);
    
    let filtered = [...requests];
    
    // Appliquer le filtre actif
    if (activeFilter === 'ממתין') {
      filtered = filtered.filter(r => r.status === 'pending' || r.status === 'pending_payment');
    } else if (activeFilter === 'מאושר') {
      filtered = filtered.filter(r => r.status === 'accepted' || r.status === 'confirmed');
    } else if (activeFilter === 'הושלם') {
      filtered = filtered.filter(r => r.status === 'completed');
    }
    
    // Appliquer la recherche
    if (text.trim() !== '') {
      const query = text.toLowerCase();
      filtered = filtered.filter(
        req =>
          req.clientName?.toLowerCase().includes(query) ||
          req.address?.fullAddress?.toLowerCase().includes(query) ||
          getServiceTypeLabel(req.serviceType).toLowerCase().includes(query)
      );
    }
    
    setFilteredRequests(filtered);
  };

  // ✅ ESCROW - Accepter (messages en hébreu)
  const acceptRequest = async (requestId) => {
    try {
      if (processingRequests[requestId]) return;
      
      setProcessingRequests(prev => ({ ...prev, [requestId]: true }));

      const token = await AsyncStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/providers/jobs/${requestId}/accept`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
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

  // ✅ ESCROW - Refuser (messages en hébreu)
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

                const token = await AsyncStorage.getItem('token');
                
                const response = await fetch(`${API_URL}/providers/jobs/${requestId}/decline`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    reason: reason || 'לא צוין סיבה'
                  })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
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
      address: request.address?.fullAddress || 'כתובת לא סופקה',
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
      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="חפש לקוח או כתובת..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#999999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'הכל' && styles.activeFilterButton]}
          onPress={() => applyFilters('הכל')}
        >
          <Ionicons 
            name="list" 
            size={16} 
            color={activeFilter === 'הכל' ? '#FFFFFF' : '#666666'} 
          />
          <Text style={[styles.filterText, activeFilter === 'הכל' && styles.activeFilterText]}>
            הכל
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'ממתין' && styles.activeFilterButton]}
          onPress={() => applyFilters('ממתין')}
        >
          <Ionicons 
            name="time" 
            size={16} 
            color={activeFilter === 'ממתין' ? '#FFFFFF' : '#666666'} 
          />
          <Text style={[styles.filterText, activeFilter === 'ממתין' && styles.activeFilterText]}>
            ממתין
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'מאושר' && styles.activeFilterButton]}
          onPress={() => applyFilters('מאושר')}
        >
          <Ionicons 
            name="checkmark-circle" 
            size={16} 
            color={activeFilter === 'מאושר' ? '#FFFFFF' : '#666666'} 
          />
          <Text style={[styles.filterText, activeFilter === 'מאושר' && styles.activeFilterText]}>
            מאושר
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'הושלם' && styles.activeFilterButton]}
          onPress={() => applyFilters('הושלם')}
        >
          <Ionicons 
            name="checkmark-done" 
            size={16} 
            color={activeFilter === 'הושלם' ? '#FFFFFF' : '#666666'} 
          />
          <Text style={[styles.filterText, activeFilter === 'הושלם' && styles.activeFilterText]}>
            הושלם
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={60} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>אין בקשות</Text>
            <Text style={styles.emptySubtitle}>בקשות חדשות יופיעו כאן</Text>
          </View>
        ) : (
          <>
            {/* Statistiques */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {requests.filter(r => r.status === 'completed').length}
                </Text>
                <Text style={styles.statLabel}>הושלם</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {requests.filter(r => r.status === 'accepted' || r.status === 'confirmed').length}
                </Text>
                <Text style={styles.statLabel}>התקבל</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {requests.filter(r => r.status === 'pending' || r.status === 'pending_payment').length}
                </Text>
                <Text style={styles.statLabel}>ממתין</Text>
              </View>
            </View>

            {/* Liste des demandes */}
            {filteredRequests.map((request) => (
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

                <View style={styles.requestInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="construct" size={16} color="#666666" />
                    <Text style={styles.infoText}>
                      {getServiceTypeLabel(request.serviceType)}
                    </Text>
                  </View>
                  
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
                    <Ionicons name="cash" size={16} color="#666666" />
                    <Text style={styles.infoText}>₪{request.price}</Text>
                  </View>
                </View>

                <View style={styles.addressRow}>
                  <Ionicons name="location" size={16} color="#666666" />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {request.address?.fullAddress || 'כתובת לא סופקה'}
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
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 15,
    marginBottom: 10,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginLeft: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333333',
    textAlign: 'right',
  },
  clearButton: {
    padding: 5,
  },
  filterContainer: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  filterButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    marginRight: 5,
    fontSize: 12,
    color: '#666666',
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: '500',
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
    marginTop: 5,
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
    marginBottom: 10,
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  addressRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  addressText: {
    fontSize: 14,
    color: '#666666',
    marginRight: 5,
    flex: 1,
    textAlign: 'right',
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
    paddingVertical: 8,
    borderRadius: 6,
    flex: 0.45,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F44336',
    flex: 0.45,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#F44336',
    fontWeight: 'bold',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default JobListScreen;