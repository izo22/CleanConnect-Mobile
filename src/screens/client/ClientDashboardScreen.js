// src/screens/client/ClientDashboardScreen.js
// ✅ VERSION MODERNE - Design startup avec coins arrondis et ombres douces
// ✅ FIXED - Remplacement Button/Chip par TouchableOpacity

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
          <Icon name="check-circle" size={16} color="#4CAF50" style={styles.phoneIcon} />
          <TouchableOpacity 
            style={styles.phoneButtonCompact}
            onPress={() => Linking.openURL(`tel:${providerPhone}`)}
            activeOpacity={0.7}
          >
            <Icon name="phone" size={14} color="#007AFF" style={{ marginLeft: 4 }} />
            <Text style={styles.phoneNumberCompact}>{providerPhone}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.phoneContainerCompact}>
        <Icon name="lock" size={16} color="#FF9800" style={styles.phoneIcon} />
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
              <Icon name="calendar-blank" size={64} color="#E0E0E0" />
            </View>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
            {activeTab === 'pending' && (
              <TouchableOpacity
                style={styles.newBookingButton}
                onPress={handleNewBooking}
                activeOpacity={0.8}
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
            <View style={[styles.statusChip, { backgroundColor: BOOKING_STATUS_COLORS[booking.status] }]}>
              <Text style={styles.statusChipText}>
                {getBookingStatusLabel(booking.status)}
              </Text>
            </View>
            
            <View style={[styles.serviceTypeChip, { backgroundColor: getServiceColor(booking.serviceType) }]}>
              <Text style={styles.serviceTypeChipText}>
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
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ספק:</Text>
              <Text style={styles.detailValue}>{booking.selectedProvider?.name || "לא הוקצה"}</Text>
            </View>
            
            {renderProviderPhone(booking)}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>כתובת:</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {booking.address?.fullAddress || "לא צוין"}
              </Text>
            </View>
          </View>
          
          <Divider style={styles.divider} />
          
          <View style={styles.bookingFooter}>
            <Text style={styles.priceText}>
              {booking.price ? booking.price.toFixed(2) + " ₪" : "--"}
            </Text>
            
            <View style={styles.actionButtons}>
              {canManuallyComplete(booking) && (
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => handleCompleteService(booking)}
                  activeOpacity={0.8}
                >
                  <Icon name="check-circle" size={16} color="white" style={{ marginLeft: 4 }} />
                  <Text style={styles.completeButtonText}>הושלם</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.viewButton, { borderColor: getServiceColor(booking.serviceType) }]}
                onPress={() => handleViewBooking(booking._id)}
                activeOpacity={0.8}
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
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>ההזמנות שלי</Text>
        </View>
      </View>
      
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'pending' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('pending')}
          activeOpacity={0.8}
        >
          <Text style={activeTab === 'pending' ? styles.activeTabLabel : styles.tabLabel}>
            ממתין
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'confirmed' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('confirmed')}
          activeOpacity={0.8}
        >
          <Text style={activeTab === 'confirmed' ? styles.activeTabLabel : styles.tabLabel}>
            מאושר
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'completed' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.8}
        >
          <Text style={activeTab === 'completed' ? styles.activeTabLabel : styles.tabLabel}>
            הושלם
          </Text>
        </TouchableOpacity>
      </View>
      
      {isLoadingBookings && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>טוען את ההזמנות שלך...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadBookings} />
          }
        >
          {bookingError ? (
            <Card style={styles.errorCard}>
              <Card.Content>
                <Text style={styles.errorText}>{bookingError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={loadBookings}
                  activeOpacity={0.8}
                >
                  <Text style={styles.retryButtonText}>נסה שוב</Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>
          ) : (
            renderBookings()
          )}
        </ScrollView>
      )}
      
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={handleNewBooking}
        color="white"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  // ✅ HEADER MODERNE
  header: {
    backgroundColor: '#2E86C1',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  
  // ✅ TABS MODERNES
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  activeTabLabel: {
    fontSize: 14,
    color: 'white',
    fontWeight: '700',
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
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  
  // ✅ ERROR CARD MODERNE
  errorCard: {
    marginVertical: 10,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  errorText: {
    color: '#DC2626',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  
  // ✅ EMPTY CARD MODERNE
  emptyCard: {
    marginVertical: 40,
    padding: 32,
    alignItems: 'center',
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  emptyCardContent: {
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  newBookingButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  newBookingButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // ✅ BOOKING CARDS MODERNES
  bookingCard: {
    marginVertical: 8,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  
  // ✅ CHIPS MODERNES
  statusChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  serviceTypeChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceTypeChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  
  dateTitle: {
    fontSize: 18,
    marginBottom: 12,
    textTransform: 'capitalize',
    fontWeight: '700',
    color: '#1F2937',
  },
  bookingDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    width: 85,
    fontWeight: '600',
    color: '#6B7280',
  },
  detailValue: {
    flex: 1,
    color: '#1F2937',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 12,
    backgroundColor: '#F3F4F6',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  
  // ✅ ACTION BUTTONS MODERNES
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FF9500',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  
  // ✅ PHONE STYLES MODERNES
  phoneContainerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 10,
    marginVertical: 6,
  },
  phoneIcon: {
    marginRight: 8,
  },
  phoneButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  phoneNumberCompact: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
  phoneDetailsCompact: {
    flex: 1,
  },
  phoneHiddenCompact: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  phoneHiddenNoteCompact: {
    fontSize: 10,
    color: '#FF9800',
    marginTop: 2,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  
  // ✅ FAB MODERNE
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
    borderRadius: 16,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default ClientDashboardScreen;