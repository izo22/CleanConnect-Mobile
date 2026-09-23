// src/screens/booking/BookingConfirmationScreen.js — CleanCasa · bleu clair
// Logique inchangée (chargement, fallback currentBooking, navigation).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY_LABELS } from '../../config/constants';
import { palette as C } from '../../config/theme';

const BookingConfirmationScreen = ({ route, navigation }) => {
  const { userBookings, fetchUserBookings, currentBooking } = useBooking();
  const { bookingId, requestType = 'payment' } = route.params || {};
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isPending = requestType === 'pending';

  useEffect(() => {
    const loadBookingDetails = async () => {
      setIsLoading(true);
      try {
        await fetchUserBookings();
        const found = userBookings.find((b) => b._id === bookingId);
        if (found) {
          setBooking(found);
        } else {
          setBooking({
            _id: bookingId || 'temp-booking-id',
            serviceType: currentBooking.serviceType || 'home',
            status: isPending ? 'pending' : 'confirmed',
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
            address: currentBooking.address || { name: 'כתובת הבית', fullAddress: 'רחוב הראשי 123, תל אביב' },
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

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('he-IL', { weekday: 'long', month: 'long', day: 'numeric' }) : 'לא מוגדר');
  const formatTime = (d) => (d ? new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '');
  const formatPrice = (p) => `₪${Number(p || 0).toFixed(0)}`;

  const handleViewBookingDetails = () => navigation.navigate('BookingDetails', { bookingId: booking._id });
  const handleReturnHome = () => navigation.reset({ index: 0, routes: [{ name: 'HomeStack' }] });
  const handleViewBookings = () => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });

  const steps = isPending
    ? [
        { icon: 'hourglass-outline', title: 'ממתין לאישור', text: 'בקשתך נשלחה לספק השירות. הוא חייב לאשר את זמינותו.' },
        { icon: 'notifications-outline', title: 'התראה', text: 'תקבל התראה ברגע שספק השירות יגיב לבקשתך.' },
        { icon: 'list-outline', title: 'מעקב', text: 'תוכל לעקוב אחר מצב בקשתך בקטע "ההזמנות שלי".' },
      ]
    : [
        { icon: 'calendar-outline', title: 'אשר את הזמינות שלך', text: 'ודא שתהיה זמין בתאריך ובשעה המתוכננים.' },
        { icon: 'home-outline', title: 'הכנת המקום', text: 'הקל על הגישה לספק השירות ופנה את האזורים לניקוי.' },
        { icon: 'sparkles-outline', title: 'שירות ותשלום', text: 'ספק השירות יגיע בשעה המתוכננת ויבצע את השירות.' },
      ];

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={styles.muted}>טוען פרטי הזמנה...</Text>
      </View>
    );
  }

  const providerName = booking?.selectedProvider?.name || booking?.provider?.name;
  const providerRating = booking?.selectedProvider?.rating || booking?.provider?.rating;
  const rows = [
    { icon: 'sparkles-outline', label: SERVICE_TYPE_LABELS[booking?.serviceType] || 'שירות ניקיון', sub: `${booking?.duration} שעות · ${CLEANING_FREQUENCY_LABELS[booking?.frequency] || ''}` },
    { icon: 'calendar-outline', label: formatDate(booking?.dateTime), sub: formatTime(booking?.dateTime) },
    { icon: 'person-outline', label: providerName, sub: providerRating ? `★ ${providerRating}` : '' },
    { icon: 'location-outline', label: booking?.address?.name || 'כתובת', sub: booking?.address?.fullAddress },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroRing}>
            <View style={styles.heroCircle}>
              <Ionicons name={isPending ? 'paper-plane-outline' : 'checkmark'} size={38} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.heroTitle}>{isPending ? 'בקשה נשלחה' : 'ההזמנה אושרה'}</Text>
          <Text style={styles.heroSubtitle}>{isPending ? 'בקשתך נשלחה לספק השירות' : 'השירות הוזמן בהצלחה'}</Text>
          <View style={styles.idPill}>
            <Text style={styles.idText} numberOfLines={1}>מס׳ הזמנה · {booking?._id}</Text>
          </View>
        </View>

        <View style={styles.card}>
          {rows.map((r, i) => (
            <View key={i} style={[styles.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.rowIcon}><Ionicons name={r.icon} size={18} color={C.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                {r.sub ? <Text style={styles.rowSub}>{r.sub}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.totalCard]}>
          <Text style={styles.totalLabel}>מחיר משוער</Text>
          <Text style={styles.totalValue}>{formatPrice(booking?.price)}</Text>
        </View>

        <Text style={styles.sectionTitle}>{isPending ? 'מידע חשוב' : 'השלבים הבאים'}</Text>
        <View style={styles.card}>
          {steps.map((s, i) => (
            <View key={i} style={[styles.step, i === steps.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.stepBadge}><Text style={styles.stepNumber}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={isPending ? handleViewBookings : handleViewBookingDetails} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>{isPending ? 'צפה בהזמנות שלי' : 'צפה בפרטי ההזמנה'}</Text>
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={handleReturnHome}>
          <Text style={styles.ghostBtnText}>חזרה לדף הבית</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingBottom: 24, gap: 12 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: C.bg },
  muted: { fontSize: 13, color: C.muted },
  hero: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  heroRing: { width: 104, height: 104, borderRadius: 52, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '700', color: C.ink },
  heroSubtitle: { fontSize: 14, color: C.muted },
  idPill: { marginTop: 6, maxWidth: '90%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  idText: { fontSize: 12, color: C.muted },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: C.ink, textAlign: 'right' },
  rowSub: { fontSize: 12, color: C.muted, textAlign: 'right', marginTop: 2 },
  totalCard: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  totalLabel: { fontSize: 15, fontWeight: '600', color: C.ink },
  totalValue: { fontSize: 22, fontWeight: '700', color: C.brand },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.ink, textAlign: 'right', marginTop: 4 },
  step: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { fontSize: 13, fontWeight: '700', color: C.primaryDark },
  stepTitle: { fontSize: 14, fontWeight: '600', color: C.ink, textAlign: 'right' },
  stepText: { fontSize: 13, color: C.muted, textAlign: 'right', marginTop: 2, lineHeight: 19 },
  footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, gap: 6, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: '#E8EFF5' },
  primaryBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 999, paddingVertical: 15 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  ghostBtn: { alignItems: 'center', paddingVertical: 10 },
  ghostBtnText: { fontSize: 14, fontWeight: '600', color: C.primary },
});

export default BookingConfirmationScreen;
