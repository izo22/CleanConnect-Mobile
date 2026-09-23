// src/screens/client/ClientDashboardScreen.js
// ✅ REFONTE BLEU CLAIR (maquette 06 · Mes réservations)
// Titre « ההזמנות שלי » · sélecteur en pilule (3 onglets conservés) · cartes bordées
// La logique (filtres, fin de service manuelle, téléphone du prestataire) est inchangée.

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert } from 'react-native';
import { Text, ActivityIndicator, FAB } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../config/theme';
import { SERVICE_TYPE_LABELS } from '../../config/constants';
import { TOP_SPACE } from '../../components/BlueUI';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
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

// Pastilles de statut (maquette 06)
const STATUS_TAGS = {
  confirmed: { bg: COLORS.statusConfirmedBg, fg: COLORS.statusConfirmedFg },
  pending:   { bg: COLORS.statusPendingBg,   fg: COLORS.statusPendingFg },
  done:      { bg: COLORS.statusDoneBg,      fg: COLORS.statusDoneFg },
  cancelled: { bg: COLORS.statusCancelledBg, fg: COLORS.statusCancelledFg },
};

const getStatusTag = (status) => {
  switch (status) {
    case BOOKING_STATUS.ACCEPTED:
    case BOOKING_STATUS.CONFIRMED:
    case BOOKING_STATUS.IN_PROGRESS:
      return STATUS_TAGS.confirmed;
    case BOOKING_STATUS.COMPLETED:
      return STATUS_TAGS.done;
    case BOOKING_STATUS.CANCELLED:
    case BOOKING_STATUS.DECLINED:
      return STATUS_TAGS.cancelled;
    default:
      return STATUS_TAGS.pending;
  }
};

const ClientDashboardScreen = () => {
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
      return format(date, 'EEEE, d בMMMM', { locale: he });      
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
  
  const normalizeServiceType = (serviceType) => {
    const map = { 'בית': 'home', 'משרד': 'office', 'בניין': 'building', 'אירבנב': 'airbnb' };
    return map[serviceType] || serviceType;
  };

  const getServiceIcon = (serviceType) => {
    const icons = {
      home: 'home-outline',
      office: 'briefcase-outline',
      building: 'business-outline',
      airbnb: 'key-outline',
    };
    return icons[normalizeServiceType(serviceType)] || 'sparkles-outline';
  };

  const getServiceTypeLabel = (serviceType) => {
    return SERVICE_TYPE_LABELS[normalizeServiceType(serviceType)] || 'שירות';
  };

  const formatBookingEndTime = (booking) => {
    if (!booking?.dateTime || !booking?.duration) return '';
    try {
      const end = new Date(new Date(booking.dateTime).getTime() + booking.duration * 60 * 60 * 1000);
      return format(end, 'HH:mm');
    } catch (error) {
      return '';
    }
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

    const providerPhone = booking.selectedProvider?.phone || booking.provider?.phone;

    if (booking.providerPhoneVisible && providerPhone) {
      return (
        <TouchableOpacity
          style={styles.phoneRow}
          onPress={() => Linking.openURL(`tel:${providerPhone}`)}
          activeOpacity={0.7}
        >
          <Ionicons name="call-outline" size={15} color={COLORS.primary} />
          <Text style={styles.phoneNumber}>{providerPhone}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.phoneRow}>
        <Ionicons name="lock-closed-outline" size={15} color={COLORS.textMuted} />
        <Text style={styles.phoneHidden}>●●● ●●● ●●●●</Text>
        <Text style={styles.phoneHiddenNote}>
          {booking.status === BOOKING_STATUS.PENDING_PAYMENT || booking.status === BOOKING_STATUS.PENDING
            ? 'יוצג לאחר אישור'
            : booking.status === BOOKING_STATUS.DECLINED
            ? 'נדחה'
            : 'לא זמין'}
        </Text>
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
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="calendar-outline" size={36} color={COLORS.primary} />
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
        </View>
      );
    }

    return filteredBookings.map(booking => {
      const tag = getStatusTag(booking.status);
      const providerName = booking.selectedProvider?.name || booking.provider?.name;
      const endTime = formatBookingEndTime(booking);

      return (
        <TouchableOpacity
          key={booking._id}
          style={styles.bookingCard}
          onPress={() => handleViewBooking(booking._id)}
          activeOpacity={0.85}
        >
          <View style={styles.bookingHeader}>
            <View style={styles.serviceRow}>
              <View style={styles.serviceIcon}>
                <Ionicons name={getServiceIcon(booking.serviceType)} size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.serviceName}>{getServiceTypeLabel(booking.serviceType)}</Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: tag.bg }]}>
              <Text style={[styles.statusChipText, { color: tag.fg }]}>
                {getBookingStatusLabel(booking.status)}
              </Text>
            </View>
          </View>

          <View style={styles.bookingDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={15} color={COLORS.textMuted} />
              <Text style={styles.detailValue}>
                {formatBookingDate(booking.dateTime)} · {formatBookingTime(booking.dateTime)}{endTime ? `–${endTime}` : ''}
              </Text>
            </View>
            {providerName ? (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={15} color={COLORS.textMuted} />
                <Text style={styles.detailValue}>{providerName}</Text>
              </View>
            ) : null}
            {renderProviderPhone(booking)}
          </View>

          <View style={styles.bookingFooter}>
            <Text style={styles.priceText}>
              ₪{booking.price ? booking.price.toFixed(2) : '0.00'}
            </Text>

            <View style={styles.actionButtons}>
              {canManuallyComplete(booking) && (
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => handleCompleteService(booking)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.completeButtonText}>הושלם ✓</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => handleViewBooking(booking._id)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewButtonText}>פרטים</Text>
                <Ionicons name="chevron-back" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
    });
  };

  if (isLoadingBookings && userBookings.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>טוען הזמנות...</Text>
      </View>
    );
  }

  const TABS = [
    { key: 'pending', label: 'ממתין' },
    { key: 'confirmed', label: 'מאושר' },
    { key: 'completed', label: 'הושלם' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ההזמנות שלי</Text>

        {/* SÉLECTEUR D'ONGLETS EN PILULE */}
        <View style={styles.tabContainer}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, activeTab === tab.key && styles.activeTabButton]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.activeTabLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {bookingError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{bookingError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBookings} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>נסה שוב</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadBookings}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {renderBookings()}
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={handleNewBooking}
        color={COLORS.white}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },

  header: {
    paddingTop: TOP_SPACE + 8,
    paddingHorizontal: 18,
    gap: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
  },

  // SÉLECTEUR EN PILULE
  tabContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: COLORS.segment,
    borderRadius: 999,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: COLORS.surface,
  },
  tabLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: COLORS.navy,
  },

  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 96,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontSize: 14,
  },

  // ERREUR
  errorCard: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 14,
    backgroundColor: COLORS.statusCancelledBg,
    borderRadius: 20,
    gap: 10,
  },
  errorText: {
    color: COLORS.statusCancelledFg,
    textAlign: 'center',
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // VIDE
  emptyCard: {
    marginTop: 32,
    padding: 28,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  newBookingButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  newBookingButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },

  // CARTES
  bookingCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  bookingHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '500',
  },

  bookingDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  detailValue: {
    flex: 1,
    color: COLORS.textBody,
    fontSize: 13,
    textAlign: 'right',
  },

  phoneRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  phoneNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  phoneHidden: {
    fontSize: 12,
    color: COLORS.textHint,
  },
  phoneHiddenNote: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  bookingFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: 10,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  actionButtons: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  completeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // FAB
  fab: {
    position: 'absolute',
    margin: 18,
    left: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
    borderRadius: 28,
  },
});

export default ClientDashboardScreen;
