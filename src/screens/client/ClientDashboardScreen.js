// src/screens/client/ClientDashboardScreen.js - REFONTE UI MINIMALISTE PREMIUM
/*
CHANGEMENTS MAJEURS APPLIQUÉS:
✓ Header: fond blanc #FFFFFF avec bordure #F3F4F6 au lieu de bleu, titre centré simple
✓ Container: fond #F9FAFB au lieu de #F5F5F5
✓ Tabs: style outline minimaliste, borderRadius 8px, hauteur réduite
✓ Cards: borderRadius 12px, bordures 1px #F3F4F6, elevation/shadow supprimées
✓ Badges: couleurs à 10% d'opacité, borderRadius 6px, tailles réduites
✓ Typographie: fontSize réduits de 10-15% (dateTitle 16px, statusChip 11px)
✓ Poids: '400' par défaut, '600' pour titres/labels importants
✓ Buttons: hauteur 40px, borderRadius 8px, ombres supprimées
✓ Colors: #111827 (textes actifs), #6B7280 (secondaires), #9CA3AF (hints)
✓ letterSpacing: -0.2 à -0.3 pour compression visuelle
✓ lineHeight: serré (1.3-1.4)
✓ Phone containers: backgrounds ultra-subtils
✓ FAB: style minimaliste sans ombre lourde
*/

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert } from 'react-native';
import { Text, Card, Title, Divider, ActivityIndicator, useTheme, FAB } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKING_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DECLINED: 'declined',
};

const BOOKING_STATUS_COLORS = {
  [BOOKING_STATUS.PENDING_PAYMENT]: '#FF9800',
  [BOOKING_STATUS.PENDING]: '#FF9800',
  [BOOKING_STATUS.ACCEPTED]: '#4CAF50',
  [BOOKING_STATUS.CONFIRMED]: '#4CAF50',
  [BOOKING_STATUS.IN_PROGRESS]: '#2196F3',
  [BOOKING_STATUS.COMPLETED]: '#9C27B0',
  [BOOKING_STATUS.CANCELLED]: '#F44336',
  [BOOKING_STATUS.DECLINED]: '#F44336',
};

const ClientDashboardScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { userBookings, fetchUserBookings, isLoadingBookings, bookingError } = useBooking();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  
  const getBookingStatusLabel = (status) => {
    const labels = {
      [BOOKING_STATUS.PENDING_PAYMENT]: 'ממתין לתשלום',
      [BOOKING_STATUS.PENDING]: 'ממתין לאישור',
      [BOOKING_STATUS.ACCEPTED]: 'מאושר',
      [BOOKING_STATUS.CONFIRMED]: 'מאושר',
      [BOOKING_STATUS.IN_PROGRESS]: 'בביצוע',
      [BOOKING_STATUS.COMPLETED]: 'הושלם',
      [BOOKING_STATUS.CANCELLED]: 'בוטל',
      [BOOKING_STATUS.DECLINED]: 'נדחה',
    };
    return labels[status] || status;
  };
  
  useEffect(() => {
    loadBookings();
  }, []);
  
  useFocusEffect(
    React.useCallback(() => {
      loadBookings();
      return () => {};
    }, [])
  );
  
  const loadBookings = async () => {
    setRefreshing(true);
    await fetchUserBookings();
    setRefreshing(false);
  };
  
  const getFilteredBookings = () => {
    if (activeTab === 'pending') {
      return userBookings.filter(booking => 
        booking.status === BOOKING_STATUS.PENDING_PAYMENT ||
        booking.status === BOOKING_STATUS.PENDING
      );
    } else if (activeTab === 'confirmed') {
      return userBookings.filter(booking => 
        booking.status === BOOKING_STATUS.ACCEPTED ||
        booking.status === BOOKING_STATUS.CONFIRMED ||
        booking.status === BOOKING_STATUS.IN_PROGRESS
      );
    } else if (activeTab === 'completed') {
      return userBookings.filter(booking => 
        booking.status === BOOKING_STATUS.COMPLETED ||
        booking.status === BOOKING_STATUS.CANCELLED ||
        booking.status === BOOKING_STATUS.DECLINED
      );
    } else {
      return userBookings;
    }
  };
  
  const formatBookingDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'PPPP', { locale: he });      
    } catch (error) {
      return 'תאריך לא זמין';
    }
  };
  
  const formatBookingTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'HH:mm');
    } catch (error) {
      return '';
    }
  };
  
  const getServiceColor = (serviceType) => {
    switch (serviceType) {
      case 'home':
      case 'בית':
        return '#4A90E2';
      case 'office':
      case 'משרד':
        return '#E67E22';
      case 'building':
      case 'בניין':
        return '#27AE60';
      case 'airbnb':
        return '#FF5A5F';
      default:
        return theme.colors.primary;
    }
  };
  
  const getServiceTypeLabel = (serviceType) => {
    const labels = {
      'home': 'בית',
      'בית': 'בית',
      'office': 'משרד',
      'משרד': 'משרד',
      'building': 'בניין',
      'בניין': 'בניין',
      'airbnb': 'אירבנב',
    };
    return labels[serviceType] || 'שירות';
  };
  
  const handleViewBooking = (bookingId) => {
    navigation.navigate('BookingDetails', { bookingId });
  };
  
  const handleNewBooking = () => {
    navigation.navigate('HomeStack');
  };
  
  const isServiceTimeEnded = (booking) => {
    if (!booking || !booking.dateTime || !booking.duration) return false;
    
    const startTime = new Date(booking.dateTime);
    const endTime = new Date(startTime.getTime() + booking.duration * 60 * 60 * 1000);
    const now = new Date();
    
    return now > endTime;
  };
  
  const canManuallyComplete = (booking) => {
    return (
      (booking?.status === 'accepted' || 
       booking?.status === 'confirmed' || 
       booking?.status === 'pending') &&
      isServiceTimeEnded(booking)
    );
  };
  
  const handleCompleteService = async (booking) => {
    try {
      const API_URL = 'https://cleanconnect-r7wt.onrender.com/api';
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        Alert.alert('שגיאה', 'אין אישור גישה. אנא התחבר מחדש.');
        return;
      }
      
      const response = await fetch(`${API_URL}/bookings/${booking._id}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        Alert.alert(
          'השירות הושלם',
          'תודה על האישור!',
          [{ text: 'אישור', onPress: () => loadBookings() }]
        );
      } else {
        Alert.alert('שגיאה', data.message || 'לא ניתן לעדכן את סטטוס ההזמנה');
      }
    } catch (error) {
      Alert.alert('שגיאה', `אירעה שגיאה: ${error.message}`);
    }
  };
  
  const renderProviderPhone = (booking) => {
    if (!booking.selectedProvider && !booking.provider) {
      return null;
    }

    const providerName = booking.selectedProvider?.name || booking.provider?.name || 'ספק לא שויך';
    const providerPhone = booking.selectedProvider?.phone || booking.provider?.phone;

    if (booking.providerPhoneVisible && providerPhone) {
      return (
        <View style={styles.phoneContainerCompact}>
          <Icon name="check-circle" size={14} color="#4CAF50" style={styles.phoneIcon} />
          <TouchableOpacity 
            style={styles.phoneButtonCompact}
            onPress={() => Linking.openURL(`tel:${providerPhone}`)}
            activeOpacity={0.7}
          >
            <Icon name="phone" size={12} color="#007AFF" style={{ marginLeft: 4 }} />
            <Text style={styles.phoneNumberCompact}>{providerPhone}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.phoneContainerCompact}>
        <Icon name="lock" size={14} color="#FF9800" style={styles.phoneIcon} />
        <View style={styles.phoneDetailsCompact}>
          <Text style={styles.phoneHiddenCompact}>●●● ●●● ●●●●</Text>
          <Text style={styles.phoneHiddenNoteCompact}>
            {booking.status === BOOKING_STATUS.PENDING_PAYMENT || booking.status === BOOKING_STATUS.PENDING 
              ? '⏳ ממתין לאישור'
              : booking.status === BOOKING_STATUS.DECLINED
              ? '❌ נדחה'
              : '🔒 לא זמין'}
          </Text>
        </View>
      </View>
    );
  };
  
  const renderBookings = () => {
    const filteredBookings = getFilteredBookings();
    
    if (filteredBookings.length === 0) {
      let emptyMessage = "";
      if (activeTab === 'pending') {
        emptyMessage = "אין לך הזמנות בהמתנה.";
      } else if (activeTab === 'confirmed') {
        emptyMessage = "אין לך הזמנות מאושרות.";
      } else if (activeTab === 'completed') {
        emptyMessage = "אין לך עדיין הזמנות שהושלמו.";
      }
      
      return (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyCardContent}>
            <View style={styles.emptyIconContainer}>
              <Icon name="calendar-blank" size={48} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
            {activeTab === 'pending' && (
              <TouchableOpacity
                style={styles.newBookingButton}
                onPress={handleNewBooking}
                activeOpacity={0.7}
              >
                <Text style={styles.newBookingButtonText}>הזמן שירות</Text>
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>
      );
    }
    
    return filteredBookings.map(booking => (
      <Card 
        key={booking._id} 
        style={styles.bookingCard}
        onPress={() => handleViewBooking(booking._id)}
      >
        <Card.Content>
          <View style={styles.bookingHeader}>
            <View style={[styles.statusChip, { backgroundColor: `${BOOKING_STATUS_COLORS[booking.status]}15` }]}>
              <Text style={[styles.statusChipText, { color: BOOKING_STATUS_COLORS[booking.status] }]}>
                {getBookingStatusLabel(booking.status)}
              </Text>
            </View>
            
            <View style={[styles.serviceTypeChip, { backgroundColor: `${getServiceColor(booking.serviceType)}10` }]}>
              <Text style={[styles.serviceTypeChipText, { color: getServiceColor(booking.serviceType) }]}>
                {getServiceTypeLabel(booking.serviceType)}
              </Text>
            </View>
          </View>
          
          <Title style={styles.dateTitle}>
            {formatBookingDate(booking.dateTime)}
          </Title>
          
          <View style={styles.bookingDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>שעה:</Text>
              <Text style={styles.detailValue}>{formatBookingTime(booking.dateTime)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>משך:</Text>
              <Text style={styles.detailValue}>{booking.duration}h</Text>
            </View>
            
            {booking.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ספק:</Text>
                <Text style={styles.detailValue}>
                  {booking.selectedProvider?.name || booking.provider?.name || 'לא שויך'}
                </Text>
              </View>
            )}
          </View>
          
          {renderProviderPhone(booking)}
          
          <View style={styles.divider} />
          
          <View style={styles.bookingFooter}>
            <Text style={styles.priceText}>
              ₪{booking.price ? booking.price.toFixed(2) : '0.00'}
            </Text>
            
            <View style={styles.actionButtons}>
              {canManuallyComplete(booking) && (
                <TouchableOpacity 
                  style={styles.completeButton}
                  onPress={() => handleCompleteService(booking)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.completeButtonText}>הושלם✓</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={[styles.viewButton, { borderColor: getServiceColor(booking.serviceType) }]}
                onPress={() => handleViewBooking(booking._id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.viewButtonText, { color: getServiceColor(booking.serviceType) }]}>
                  פרטים
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card.Content>
      </Card>
    ));
  };
  
  if (isLoadingBookings && userBookings.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>טוען הזמנות...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* HEADER MINIMALISTE BLANC - SIMPLIFIÉ */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>הזמנות</Text>
      </View>
      
      {/* TABS MINIMALISTES */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'pending' && styles.activeTabButton]}
          onPress={() => setActiveTab('pending')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, activeTab === 'pending' && styles.activeTabLabel]}>
            ממתין
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'confirmed' && styles.activeTabButton]}
          onPress={() => setActiveTab('confirmed')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, activeTab === 'confirmed' && styles.activeTabLabel]}>
            מאושר
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'completed' && styles.activeTabButton]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, activeTab === 'completed' && styles.activeTabLabel]}>
            הושלם
          </Text>
        </TouchableOpacity>
      </View>
      
      {bookingError && (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={styles.errorText}>{bookingError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadBookings} activeOpacity={0.7}>
              <Text style={styles.retryButtonText}>נסה שוב</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>
      )}
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadBookings}
            colors={['#007AFF']}
          />
        }
      >
        {renderBookings()}
      </ScrollView>
      
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={handleNewBooking}
        color="#FFFFFF"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  
  // HEADER MINIMALISTE BLANC - SIMPLIFIÉ
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  
  // TABS MINIMALISTES
  tabContainer: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
  },
  activeTabButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  tabLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  activeTabLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontWeight: '400',
    fontSize: 14,
  },
  
  // ERROR CARD
  errorCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    color: '#DC2626',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '400',
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  
  // EMPTY CARD
  emptyCard: {
    marginVertical: 40,
    padding: 32,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  emptyCardContent: {
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  newBookingButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
  },
  newBookingButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  
  // BOOKING CARDS
  bookingCard: {
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  bookingHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  
  // CHIPS
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  serviceTypeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceTypeChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  
  dateTitle: {
    fontSize: 16,
    marginBottom: 10,
    textTransform: 'capitalize',
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  bookingDetails: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row-reverse',
    marginBottom: 4,
  },
  detailLabel: {
    width: 60,
    fontWeight: '500',
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  detailValue: {
    flex: 1,
    color: '#111827',
    fontWeight: '400',
    fontSize: 13,
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  divider: {
    height: 1,
    marginVertical: 12,
    backgroundColor: '#F3F4F6',
  },
  bookingFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
  },
  
  // ACTION BUTTONS
  actionButtons: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  
  completeButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FF9500',
    height: 32,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  
  viewButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  
  // PHONE STYLES
  phoneContainerCompact: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  phoneIcon: {
    marginLeft: 8,
  },
  phoneButtonCompact: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  phoneNumberCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 4,
    letterSpacing: -0.1,
  },
  phoneDetailsCompact: {
    flex: 1,
  },
  phoneHiddenCompact: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  phoneHiddenNoteCompact: {
    fontSize: 10,
    color: '#FF9800',
    marginTop: 2,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  
  // FAB
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
    borderRadius: 14,
  },
});

export default ClientDashboardScreen;