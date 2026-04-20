// src/screens/booking/BookingConfirmationScreen.js
// ✅ גרסה מתורגמת לעברית עם תמיכה ב-RTL
// ✅ תוקן: נוסף תמיכה ב-Airbnb עם צבע #FF5A5F
// 🐛 תוקן: החלפת Button ב-TouchableOpacity לפתרון שגיאת labelLarge
// ✅ REDESIGN: Style premium minimaliste

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY_LABELS, getServiceColor, getServiceBackgroundColor } from '../../config/constants';

const BookingConfirmationScreen = ({ route, navigation }) => {
  const { userBookings, fetchUserBookings, currentBooking } = useBooking();
  const { bookingId, requestType = 'payment' } = route.params || {};

  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBookingDetails = async () => {
      setIsLoading(true);
      try {
        await fetchUserBookings();
        const foundBooking = userBookings.find(b => b._id === bookingId);
        if (foundBooking) {
          setBooking(foundBooking);
        } else {
          setBooking({
            _id: bookingId || 'temp-booking-id',
            serviceType: currentBooking.serviceType || 'home',
            status: requestType === 'pending' ? 'pending' : 'confirmed',
            dateTime: currentBooking.dateTime || new Date().toISOString(),
            duration: currentBooking.duration || 1,
            frequency: currentBooking.frequency || 'one_time',
            price: currentBooking.price || 199.99,
            provider: {
              _id: currentBooking.selectedProvider?._id || 'provider-id',
              name: currentBooking.selectedProvider?.name || 'CleanPro Services',
              rating: currentBooking.selectedProvider?.rating || 4.8,
              phone: '+972 50 123 4567',
            },
            address: currentBooking.address || {
              name: 'כתובת הבית',
              fullAddress: 'רחוב הראשי 123, תל אביב',
            }
          });
        }
      } catch (error) {
        console.error('שגיאה בטעינת פרטי הזמנה:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadBookingDetails();
  }, [bookingId, fetchUserBookings, requestType, currentBooking]);

  const getHeaderContent = () => {
    if (requestType === 'pending') {
      return { icon: 'document-text-outline', title: 'בקשה נשלחה', subtitle: 'בקשתך נשלחה לספק השירות' };
    }
    return { icon: 'checkmark-circle-outline', title: 'ההזמנה אושרה', subtitle: 'השירות הוזמן בהצלחה' };
  };

  const headerContent = getHeaderContent();
  const serviceColor = getServiceColor(booking?.serviceType || 'home');
  const serviceBgColor = getServiceBackgroundColor(booking?.serviceType || 'home');

  const formatDate = (dateString) => {
    if (!dateString) return 'לא מוגדר';
    return new Date(dateString).toLocaleDateString('he-IL', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (price) => `${price.toFixed(2)} ₪`;

  const handleViewBookingDetails = () => navigation.navigate('BookingDetails', { bookingId: booking._id });
  const handleReturnHome = () => navigation.reset({ index: 0, routes: [{ name: 'HomeStack' }] });
  const handleViewBookings = () => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });

  const pendingSteps = [
    { title: 'ממתין לאישור', text: 'בקשתך נשלחה לספק השירות. הוא חייב לאשר את זמינותו.' },
    { title: 'התראה', text: 'תקבל התראה ברגע שספק השירות יגיב לבקשתך.' },
    { title: 'מעקב', text: 'תוכל לעקוב אחר מצב בקשתך בקטע "ההזמנות שלי".' },
  ];

  const confirmedSteps = [
    { title: 'אשר את הזמינות שלך', text: 'ודא שתהיה זמין בתאריך ובשעה המתוכננים.' },
    { title: 'הכנת המקום', text: 'הקל על הגישה לספק השירות ופנה את האזורים לניקוי.' },
    { title: 'שירות ותשלום', text: 'ספק השירות יגיע בשעה המתוכננת ויבצע את השירות.' },
  ];

  const steps = requestType === 'pending' ? pendingSteps : confirmedSteps;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={serviceColor} />
        <Text style={styles.loadingText}>טוען פרטי הזמנה...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: serviceBgColor }]}>
        <View style={[styles.iconWrapper, { backgroundColor: `${serviceColor}15` }]}>
          <Ionicons name={headerContent.icon} size={36} color={serviceColor} />
        </View>
        <Text style={[styles.headerTitle, { color: serviceColor }]}>{headerContent.title}</Text>
        <Text style={styles.headerSubtitle}>{headerContent.subtitle}</Text>
      </View>

      {/* BOOKING ID */}
      <View style={styles.idCard}>
        <Text style={styles.idLabel}>מספר הזמנה</Text>
        <Text style={styles.idValue}>{booking?._id}</Text>
      </View>

      {/* DETAILS CARD */}
      <View style={styles.card}>

        {/* Service */}
        <View style={styles.row}>
          <View style={styles.rowRight}>
            <Text style={styles.rowLabel}>פרטי השירות</Text>
            <Text style={styles.rowValue}>
              {SERVICE_TYPE_LABELS[booking?.serviceType] || 'שירות ניקיון'}
            </Text>
            <Text style={styles.rowSub}>
              {booking?.duration}h • {CLEANING_FREQUENCY_LABELS[booking?.frequency]}
            </Text>
          </View>
          <View style={[styles.iconBadge, { backgroundColor: `${serviceColor}10` }]}>
            <Ionicons name="brush-outline" size={18} color={serviceColor} />
          </View>
        </View>

        <View style={styles.separator} />

        {/* Date */}
        <View style={styles.row}>
          <View style={styles.rowRight}>
            <Text style={styles.rowLabel}>תאריך ושעה</Text>
            <Text style={styles.rowValue}>{formatDate(booking?.dateTime)}</Text>
            <Text style={styles.rowSub}>{formatTime(booking?.dateTime)}</Text>
          </View>
          <View style={[styles.iconBadge, { backgroundColor: `${serviceColor}10` }]}>
            <Ionicons name="calendar-outline" size={18} color={serviceColor} />
          </View>
        </View>

        <View style={styles.separator} />

        {/* Provider */}
        <View style={styles.row}>
          <View style={styles.rowRight}>
            <Text style={styles.rowLabel}>ספק השירות</Text>
            <Text style={styles.rowValue}>{booking?.selectedProvider?.name || booking?.provider?.name}</Text>
            <Text style={styles.rowSub}>
              דירוג: {booking?.selectedProvider?.rating || booking?.provider?.rating}/5
            </Text>
          </View>
          <View style={[styles.iconBadge, { backgroundColor: `${serviceColor}10` }]}>
            <Ionicons name="person-outline" size={18} color={serviceColor} />
          </View>
        </View>

        <View style={styles.separator} />

        {/* Address */}
        <View style={styles.row}>
          <View style={styles.rowRight}>
            <Text style={styles.rowLabel}>מיקום השירות</Text>
            <Text style={styles.rowValue}>{booking?.address?.name || 'כתובת'}</Text>
            <Text style={styles.rowSub}>{booking?.address?.fullAddress}</Text>
          </View>
          <View style={[styles.iconBadge, { backgroundColor: `${serviceColor}10` }]}>
            <Ionicons name="location-outline" size={18} color={serviceColor} />
          </View>
        </View>

        <View style={styles.separator} />

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={[styles.priceValue, { color: serviceColor }]}>
            {formatPrice(booking?.price || 0)}
          </Text>
          <Text style={styles.priceLabel}>מחיר משוער</Text>
        </View>

      </View>

      {/* STEPS CARD */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {requestType === 'pending' ? 'מידע חשוב' : 'השלבים הבאים'}
        </Text>

        {steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
            <View style={[styles.stepBadge, { backgroundColor: `${serviceColor}10` }]}>
              <Text style={[styles.stepNumber, { color: serviceColor }]}>{i + 1}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* BUTTONS */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: serviceColor }]}
          onPress={requestType === 'pending' ? handleViewBookings : handleViewBookingDetails}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>
            {requestType === 'pending' ? 'צפה בהזמנות שלי' : 'צפה בפרטי ההזמנה'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outlineButton, { borderColor: serviceColor }]}
          onPress={handleReturnHome}
          activeOpacity={0.8}
        >
          <Text style={[styles.outlineButtonText, { color: serviceColor }]}>חזרה לדף הבית</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
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
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
  },

  // Header
  header: {
    paddingTop: 64,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'center',
  },

  // ID Card
  idCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
  },
  idLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  idValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    letterSpacing: -0.2,
    marginBottom: 20,
  },

  // Row
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  rowRight: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 0,
  },
  rowLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 4,
    textAlign: 'right',
  },
  rowValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    textAlign: 'right',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '400',
    textAlign: 'right',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#F9FAFB',
    marginVertical: 16,
  },

  // Price
  priceRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },

  // Steps
  stepRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  stepContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  stepText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'right',
    lineHeight: 18,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginTop: 2,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Buttons
  buttonContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 10,
  },
  primaryButton: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  outlineButton: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  outlineButtonText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});

export default BookingConfirmationScreen;