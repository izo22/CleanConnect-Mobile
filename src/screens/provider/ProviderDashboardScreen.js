// ProviderDashboardScreen.js - REFONTE UI MINIMALISTE PREMIUM
/*
CHANGEMENTS MAJEURS:
- Typographie: tailles réduites (28→24, 24→20, 18→16, 14→12)
- Poids: 'bold' → '600'
- Container: fond #F9FAFB
- Cards: borderRadius 12px, bordures 1px #F3F4F6, shadowOpacity 0.03
- Stats: fontSize 24→20, fontWeight 'bold'→'600'
- Request cards: elevation 2→1, shadowOpacity 0.1→0.03
- Status badges: opacité 10%, borderRadius 6px, fontSize 11
- Buttons: paddingVertical 12, borderRadius 8px
- Colors: #111827, #6B7280, #9CA3AF
- Spacing: doublé entre sections
*/
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { providerService } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const ProviderDashboardScreen = ({ navigation }) => {
  const isRTL = true;
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchProviderData = async () => {
    try {
      setLoading(true);
      const response = await providerService.getProviderProfile();
      setProvider(response.data);
      setError(null);
    } catch (err) {
      setError('שגיאה בטעינת הנתונים');
      console.error('Error fetching provider data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProviderData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProviderData();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return { bg: '#F59E0B10', text: '#F59E0B' };
      case 'accepted':
        return { bg: '#10B98110', text: '#10B981' };
      case 'in_progress':
        return { bg: '#3B82F610', text: '#3B82F6' };
      case 'completed':
        return { bg: '#10B98110', text: '#10B981' };
      case 'cancelled':
        return { bg: '#EF444410', text: '#EF4444' };
      default:
        return { bg: '#F59E0B10', text: '#F59E0B' };
    }
  };

  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'ממתין';
      case 'pending_payment':       // ← ajouter
      case 'payment_pending': return 'ממתין לתשלום';  // ← ajouter
      case 'accepted':
      case 'confirmed': return 'מאושר';
      case 'completed': return 'הושלם';
      default: return status;
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month} בשעה ${hours}:${minutes}`;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, styles.textRTL]}>טוען...</Text>
      </View>
    );
  }

  if (error && !provider) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={48} color="#EF4444" />
        <Text style={[styles.errorText, styles.textRTL]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProviderData}>
          <Text style={styles.retryButtonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pendingRequests = provider?.requests?.filter(req => 
    req.status === 'pending' || req.status === 'pending_payment'
  ) || [];  const completedJobs = provider?.requests?.filter(req => req.status === 'completed') || [];
  const todayRequests = provider?.requests?.filter(req => {
    const requestDate = new Date(req.date);
    const today = new Date();
    return requestDate.toDateString() === today.toDateString();
  }) || [];

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={[styles.header, styles.headerRTL]}>
          <Text style={[styles.name, styles.textRTL]}>
            שלום {provider?.firstName || ''}
          </Text>
        </View>

        {/* Stats Card */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.textRTL]}>הסטטיסטיקה שלי</Text>
          </View>
          <Card.Content>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pendingRequests.length}</Text>
                <Text style={[styles.statLabel, styles.textRTL]}>ממתינות</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedJobs.length}</Text>
                <Text style={[styles.statLabel, styles.textRTL]}>הושלמו</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {provider?.rating ? provider.rating.toFixed(1) : '0.0'}
                </Text>
                <Text style={[styles.statLabel, styles.textRTL]}>דירוג</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Info Card */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.textRTL]}>המידע שלי</Text>
          </View>
          <Card.Content>
            <View style={[styles.infoRow, styles.infoRowRTL]}>
              <Text style={[styles.infoLabel, styles.textRTL]}>אימייל</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.infoValue, styles.textRTL]}>{provider?.email}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowRTL]}>
              <Text style={[styles.infoLabel, styles.textRTL]}>טלפון</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.infoValue, styles.textRTL]}>{provider?.phone}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowRTL]}>
              <Text style={[styles.infoLabel, styles.textRTL]}>שירותים</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.infoValue, styles.textRTL]}>
                {provider?.serviceDetails?.map(s => s.type).join(', ')}
              </Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowRTL]}>
              <Text style={[styles.infoLabel, styles.textRTL]}>אזורים</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={[styles.infoValue, styles.textRTL]}>
                {provider?.serviceAreas?.join(', ')}
              </Text>
            </View>
          </Card.Content>
          <View style={styles.actionPadding}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('Profile', { screen: 'ProviderProfile' })}
              >
              <Icon name="edit" size={18} color="#007AFF" />
              <Text style={[styles.editButtonText, styles.textRTL]}>ערוך פרופיל</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Today's Requests */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.textRTL]}>משימות להיום</Text>
          </View>
          <Card.Content>
            {todayRequests.length > 0 ? (
              <View style={styles.requestsGrid}>
                {todayRequests.map((request) => {
                  const statusColor = getStatusColor(request.status);
                  return (
                    <TouchableOpacity
                      key={request._id}
                      style={styles.modernRequestCard}
                      onPress={() => navigation.navigate('Jobs', { 
                        screen: 'JobDetails', 
                        params: { jobId: request._id } 
                      })}
                    >
                      <View style={styles.modernRequestHeader}>
                        <View style={styles.modernRequestClient}>
                          <Icon name="person" size={18} color="#9CA3AF" />
                          <Text style={[styles.clientName, styles.textRTL]}>
                            {request.client?.firstName} {request.client?.lastName}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                          <Text style={[styles.statusText, { color: statusColor.text }, styles.textRTL]}>
                            {getStatusLabel(request.status)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.modernRequestBody}>
                        <View style={[styles.requestInfoRow, styles.requestInfoRowRTL]}>
                          <Icon name="cleaning-services" size={16} color="#6B7280" />
                          <Text style={[styles.serviceType, styles.textRTL]}>
                            {request.serviceType}
                          </Text>
                        </View>
                        <View style={[styles.requestInfoRow, styles.requestInfoRowRTL]}>
                          <Icon name="schedule" size={16} color="#6B7280" />
                          <Text style={[styles.requestTime, styles.textRTL]}>
                            {formatDateTime(request.date)}
                          </Text>
                        </View>
                        <View style={[styles.requestInfoRow, styles.requestInfoRowRTL]}>
                          <Icon name="location-on" size={16} color="#6B7280" />
                          <Text style={[styles.requestAddress, styles.textRTL]} numberOfLines={1}>
                            {request.address}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.modernRequestFooter}>
                        <Text style={[styles.requestPrice, styles.textRTL]}>
                        ₪{request.price || request.totalPrice || 0}                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noRequests}>
                <Icon name="inbox" size={48} color="#E5E7EB" />
                <Text style={[styles.noRequestsText, styles.textRTL]}>
                  אין משימות להיום
                </Text>
              </View>
            )}
          </Card.Content>
          
          <View style={styles.actionPadding}>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('Jobs', { screen: 'RequestsScreen' })}
            >
              <Text style={[styles.viewAllButtonText, styles.textRTL]}>צפה בכל הבקשות</Text>
              <Icon name="arrow-back" size={18} color="#007AFF" style={{ transform: [{ scaleX: -1 }] }} />
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },
  errorText: {
    marginVertical: 16,
    color: '#EF4444',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '400',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  header: {
    marginBottom: 24,
    paddingVertical: 8,
  },
  headerRTL: {
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.4,
    lineHeight: 31,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '400',
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
    fontWeight: '600',
    fontSize: 12,
    color: '#111827',
    letterSpacing: -0.2,
  },
  colon: {
    marginHorizontal: 6,
    fontWeight: '600',
    fontSize: 12,
    color: '#111827',
  },
  infoValue: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
  },
  actionPadding: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF10',
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  requestsGrid: {
    gap: 12,
  },
  modernRequestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
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
  modernRequestBody: {
    gap: 8,
    marginBottom: 12,
  },
  requestInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestInfoRowRTL: {
    flexDirection: 'row-reverse',
  },
  serviceType: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  requestTime: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
  },
  requestAddress: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    flex: 1,
  },
  modernRequestFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  requestPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    letterSpacing: -0.3,
  },
  noRequests: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noRequestsText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF10',
  },
  viewAllButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ProviderDashboardScreen;