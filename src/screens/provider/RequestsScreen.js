// RequestsScreen.js - REFONTE UI MINIMALISTE PREMIUM
/*
CHANGEMENTS MAJEURS:
- Typographie: tailles réduites (24→20, 20→17, 16→14, 14→12)
- Poids: 'bold' → '600', '500' → '400'
- Container: fond #F9FAFB
- Filter tabs: borderRadius 8px, fontSize 12, paddingVertical 6
- Cards: borderRadius 12px, bordures 1px #F3F4F6, elevation 1
- Status badges: opacité 10%, borderRadius 6px, fontSize 11
- Action buttons: paddingVertical 12, borderRadius 8px
- Client name: fontSize 20→17
- Service name: fontSize 16→14
- Info text: fontSize 14→12
- Colors: #111827, #6B7280, #9CA3AF
- Spacing: marginBottom entre cards 10→16
*/
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
  const [activeFilter, setActiveFilter] = useState('all');

  useFocusEffect(
    React.useCallback(() => {
      loadRequests();
    }, [])
  );

  const formatAddress = (address) => {
    if (!address) return 'כתובת לא סופקה';
    if (typeof address === 'string') return address;
    if (address.fullAddress) return address.fullAddress;
    
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

  const handleAccept = async (requestId) => {
    setProcessingRequests(prev => ({ ...prev, [requestId]: true }));
    
    try {
      await providerService.acceptJob(requestId);
      await loadRequests();
      Alert.alert('הצלחה', 'הבקשה אושרה בהצלחה');
    } catch (error) {
      console.error('Erreur acceptation:', error);
      Alert.alert('שגיאה', 'לא ניתן לאשר את הבקשה');
    } finally {
      setProcessingRequests(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleDecline = async (requestId) => {
    Alert.alert(
      'דחיית בקשה',
      'האם אתה בטוח שברצונך לדחות את הבקשה?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'דחה',
          style: 'destructive',
          onPress: async () => {
            setProcessingRequests(prev => ({ ...prev, [requestId]: true }));
            try {
              await providerService.declineJob(requestId, { reason: 'declined_by_provider' });
              await loadRequests();
              Alert.alert('הצלחה', 'הבקשה נדחתה');
            } catch (error) {
              console.error('Erreur refus:', error);
              Alert.alert('שגיאה', 'לא ניתן לדחות את הבקשה');
            } finally {
              setProcessingRequests(prev => ({ ...prev, [requestId]: false }));
            }
          }
        }
      ]
    );
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} בשעה ${hours}:${minutes}`;
  };

  const getStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'pending_payment':
        return { label: 'ממתין', bg: '#F59E0B10', text: '#F59E0B' };
      case 'accepted':
        return { label: 'מאושר', bg: '#10B98110', text: '#10B981' };
      case 'in_progress':
        return { label: 'בביצוע', bg: '#3B82F610', text: '#3B82F6' };
      case 'completed':
        return { label: 'הושלם', bg: '#10B98110', text: '#10B981' };
      case 'cancelled':
        return { label: 'בוטל', bg: '#EF444410', text: '#EF4444' };
      default:
        return { label: status, bg: '#F59E0B10', text: '#F59E0B' };
    }
  };

  const filterRequests = () => {
    switch (activeFilter) {
      case 'pending':
        return requests.filter(r => r.status?.toLowerCase() === 'pending' || r.status?.toLowerCase() === 'pending_payment');
      case 'accepted':
        return requests.filter(r => r.status?.toLowerCase() === 'accepted' || r.status?.toLowerCase() === 'in_progress');
      case 'completed':
        return requests.filter(r => r.status?.toLowerCase() === 'completed');
      default:
        return requests;
    }
  };

  const filteredRequests = filterRequests();

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>טוען בקשות...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Filters */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>הבקשות שלי</Text>
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
              הכל ({requests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'pending' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('pending')}
          >
            <Text style={[styles.filterText, activeFilter === 'pending' && styles.filterTextActive]}>
              ממתינות ({requests.filter(r => r.status?.toLowerCase() === 'pending' || r.status?.toLowerCase() === 'pending_payment').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'accepted' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('accepted')}
          >
            <Text style={[styles.filterText, activeFilter === 'accepted' && styles.filterTextActive]}>
              מאושרות ({requests.filter(r => r.status?.toLowerCase() === 'accepted' || r.status?.toLowerCase() === 'in_progress').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'completed' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('completed')}
          >
            <Text style={[styles.filterText, activeFilter === 'completed' && styles.filterTextActive]}>
              הושלמו ({requests.filter(r => r.status?.toLowerCase() === 'completed').length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="inbox-outline" size={64} color="#E5E7EB" />
            <Text style={styles.emptyText}>אין בקשות להצגה</Text>
          </View>
        ) : (
          filteredRequests.map((request) => {
            const statusConfig = getStatusConfig(request.status);
            const isProcessing = processingRequests[request._id];

            return (
              <TouchableOpacity
                key={request._id}
                style={styles.requestCard}
                onPress={() => navigation.navigate('JobDetails', { jobId: request._id })}
                disabled={isProcessing}
              >
                {/* Header */}
                <View style={styles.requestHeader}>
                  <View style={styles.clientInfo}>
                    <Ionicons name="person" size={18} color="#9CA3AF" />
                    <Text style={styles.clientName}>{request.clientName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.statusText, { color: statusConfig.text }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Body */}
                <View style={styles.requestBody}>
                  <View style={styles.infoRow}>
                    <Ionicons name="cleaning-services" size={16} color="#6B7280" />
                    <Text style={styles.serviceType}>{request.serviceType}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={16} color="#6B7280" />
                    <Text style={styles.dateTime}>{formatDateTime(request.dateTime)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color="#6B7280" />
                    <Text style={styles.address} numberOfLines={1}>
                      {formatAddress(request.address)}
                    </Text>
                  </View>
                </View>

                {/* Footer */}
                <View style={styles.requestFooter}>
                  <Text style={styles.price}>₪{request.price}</Text>
                  {(request.status?.toLowerCase() === 'pending' || request.status?.toLowerCase() === 'pending_payment') && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAccept(request._id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.acceptButtonText}>אשר</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineButton}
                        onPress={() => handleDecline(request._id)}
                        disabled={isProcessing}
                      >
                        <Text style={styles.declineButtonText}>דחה</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'right',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    marginBottom: 16,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '400',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  requestBody: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceType: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    letterSpacing: -0.2,
    flex: 1,
    textAlign: 'right',
  },
  dateTime: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  address: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    letterSpacing: -0.3,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
    minWidth: 60,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});

export default RequestsScreen;