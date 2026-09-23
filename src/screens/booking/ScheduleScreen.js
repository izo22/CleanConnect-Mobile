// src/screens/booking/ScheduleScreen.js
// ✅ VERSION CORRIGÉE : Charge les disponibilités du prestataire depuis le backend
// ✅ REFONTE BLEU CLAIR (maquette 04) : bannière · 1. date · 2. heure · 3. détails du service

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Text } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, API_URL } from '../../config/constants';
import { COLORS } from '../../config/theme';
import { ScreenHeader, PrimaryButton, TOP_SPACE } from '../../components/BlueUI';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const HEBREW_WEEKDAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

const HEBREW_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const getDaysInMonth = (year, month) => {
  const date = new Date(year, month, 1);
  const days = [];
  
  const firstDayOfMonth = date.getDay();
  const emptyCells = firstDayOfMonth;
  
  for (let i = 0; i < emptyCells; i++) {
    days.push({ date: null, day: '', isCurrentMonth: false });
  }
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let i = 1; i <= daysInMonth; i++) {
    const currentDate = new Date(year, month, i);
    days.push({
      date: currentDate,
      day: i,
      isCurrentMonth: true,
      isToday: isToday(currentDate),
    });
  }
  
  return days;
};

const isToday = (date) => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(12, 0, 0, 0);
  
  return (
    compareDate.getDate() === today.getDate() &&
    compareDate.getMonth() === today.getMonth() &&
    compareDate.getFullYear() === today.getFullYear()
  );
};

const ScheduleScreen = ({ route, navigation }) => {
  const { currentBooking, updateBooking } = useBooking();
  // La bio est désormais affichée sur ProviderProfileView (maquette 03)
  const { providerId, providerName, initialDate } = route?.params || {};
  
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [localDuration, setLocalDuration] = useState(() => {
    const initial = currentBooking?.duration;
    return (typeof initial === 'number' && !isNaN(initial) && initial >= 1) ? Math.floor(initial) : 1;
  });
  const getMonthName = (month) => HEBREW_MONTHS[month];
  const getDayName = (dayOfWeek) => HEBREW_DAY_NAMES[dayOfWeek];

  useEffect(() => {
    if (currentBooking?.duration && currentBooking.duration !== localDuration) {
      const value = currentBooking.duration;
      const validDuration = (typeof value === 'number' && !isNaN(value) && value >= 1) ? Math.floor(value) : 2;
      setLocalDuration(validDuration);
    }
  }, [currentBooking?.duration]);

  const handleDurationChange = useCallback((newDuration) => {
    if (isUpdating) return;
    if (typeof newDuration !== 'number' || isNaN(newDuration)) return;
    if (newDuration < 1 || newDuration > 50) return;
    
    const validDuration = Math.floor(newDuration);
    setIsUpdating(true);
    
    requestAnimationFrame(() => {
      setSelectedTime(null);
      setLocalDuration(validDuration);
      updateBooking({ duration: validDuration });
      
      setTimeout(() => {
        setIsUpdating(false);
      }, 100);
    });
  }, [updateBooking, localDuration, isUpdating]);

  // ✅ CORRIGÉ : Charger les disponibilités du prestataire depuis le BACKEND
  const loadAvailabilities = useCallback(async () => {
    if (!providerId) {
      console.log('⚠️ Pas de providerId');
      return;
    }
    
    setIsLoadingData(true);
    try {
      console.log('📥 CLIENT: Chargement des disponibilités du prestataire depuis le backend...');
      console.log('   ProviderId:', providerId);
      console.log('   URL:', `${API_URL}/providers`);
      
      // Récupérer tous les providers (route publique)
      const response = await fetch(`${API_URL}/providers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      const providers = result.data || result;
      
      // Trouver le provider spécifique
      const provider = providers.find(p => p._id === providerId);
      
      if (provider && provider.availability) {
        console.log(`✅ CLIENT: ${provider.availability.length} disponibilités trouvées pour le prestataire`);
        setAvailabilities(provider.availability);
      } else {
        console.log('⚠️ CLIENT: Aucune disponibilité trouvée pour ce prestataire');
        setAvailabilities([]);
      }
    } catch (error) {
      console.error('❌ CLIENT: Erreur loadAvailabilities:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את הזמינויות');
      setAvailabilities([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [providerId]);

  const loadBookings = useCallback(async () => {
    if (!providerId) return;
    try {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  
      const response = await fetch(
        `${API_URL}/public/providers/${providerId}/bookings?from=${from}&to=${to}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
  
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
      const result = await response.json();
      const bookings = (result.data || []).map(b => {
        console.log('📋 RAW BOOKING:', JSON.stringify(b));
        return {
          id: b._id,
          providerId,
          date: b.dateTime ?? b.date ?? b.scheduledAt ?? b.scheduledDate,
          duration: typeof b.duration === 'number' ? b.duration : Number(b.duration) || 1,
          status: b.status,
        };
      });
      setExistingBookings(bookings);
    } catch (error) {
      console.error('❌ loadBookings:', error);
      setExistingBookings([]);
    }
  }, [providerId]);

  const hasAvailability = useMemo(() => {
    return (date) => {
      if (!date || !availabilities.length) return false;
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayOfWeek = date.getDay();
      
      return availabilities.some(av => {
        if (av.isRecurring) {
          return av.dayOfWeek === dayOfWeek && av.status === 'available';
        } else {
          return av.date === formattedDate && av.status === 'available';
        }
      });
    };
  }, [availabilities]);

  const calculateSlots = useCallback((targetDate, currentDuration) => {
    if (!targetDate || !currentDuration || currentDuration < 1) return [];
    
    const dayOfWeek = targetDate.getDay();
    
    const dayAvailabilities = availabilities.filter(av => {
      if (av.isRecurring) {
        return av.dayOfWeek === dayOfWeek && av.status === 'available';
      } else {
        const avDate = new Date(av.date);
        const matches = avDate.getFullYear() === targetDate.getFullYear() &&
               avDate.getMonth() === targetDate.getMonth() &&
               avDate.getDate() === targetDate.getDate() &&
               av.status === 'available';
        return matches;
      }
    });
    
    if (dayAvailabilities.length === 0) {
      return [];
    }
    
    const uniqueAvailabilities = dayAvailabilities.reduce((acc, av) => {
      const key = `${av.startTime}-${av.endTime}`;
      if (!acc.find(item => `${item.startTime}-${item.endTime}` === key)) {
        acc.push(av);
      }
      return acc;
    }, []);
    const dateBookings = existingBookings.filter(booking => {
      if (!booking.date) return false;
      const bookingDate = new Date(booking.date);
      return bookingDate.toDateString() === targetDate.toDateString() && 
             booking.status !== 'cancelled';
    });
    
    const allSlots = [];
    
    uniqueAvailabilities.forEach(av => {
      const [startHour, startMinute] = av.startTime.split(':').map(Number);
      const [endHour, endMinute] = av.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const durationMinutes = Number(currentDuration) * 60;
      
      for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += 30) {
        const slotHour = Math.floor(minutes / 60);
        const slotMinute = minutes % 60;
        const slotEndMinutes = minutes + durationMinutes;
        const slotEndHour = Math.floor(slotEndMinutes / 60);
        const slotEndMinute = slotEndMinutes % 60;
        
        const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`;
        const slotEndTime = `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMinute).padStart(2, '0')}`;
        
        const hasConflict = dateBookings.some(booking => {
          const bookingStart = new Date(booking.date);
          const bookingStartMinutes = bookingStart.getHours() * 60 + bookingStart.getMinutes();
          const bookingEndMinutes = bookingStartMinutes + (booking.duration * 60);
          
          return (minutes < bookingEndMinutes && slotEndMinutes > bookingStartMinutes);
        });
        
        if (!hasConflict) {
          allSlots.push({
            time: slotTime,
            endTime: slotEndTime,
            minutes: minutes
          });
        }
      }
    });
    
    allSlots.sort((a, b) => a.minutes - b.minutes);
    
    return allSlots;
  }, [availabilities, existingBookings, localDuration, currentBooking]);

  useEffect(() => {
    if (selectedDate && localDuration && availabilities.length > 0) {
      const slots = calculateSlots(selectedDate, localDuration);
      setAvailableSlots(slots);
    } else {
      setAvailableSlots([]);
    }
  }, [selectedDate, localDuration, availabilities, existingBookings]);

  useEffect(() => {
    const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    setCalendarDays(days);
  }, [currentDate]);

  useEffect(() => {
    loadAvailabilities();
    loadBookings();
  }, [loadAvailabilities, loadBookings]);

  // Jour choisi depuis ProviderProfileView (format YYYY-MM-DD) → présélection
  useEffect(() => {
    if (!initialDate || isLoadingData || !availabilities.length) return;
    const [y, m, d] = initialDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (!isNaN(date.getTime()) && hasAvailability(date)) {
      setCurrentDate(date);
      setSelectedDate(date);
    }
  }, [initialDate, isLoadingData, availabilities, hasAvailability]);

  const changeMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleDateSelect = (day) => {
    if (!day.isCurrentMonth || !day.date) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDay = new Date(day.date);
    selectedDay.setHours(0, 0, 0, 0);
    
    if (selectedDay < today) {
      Alert.alert('תאריך לא תקין', 'אנא בחר תאריך עתידי');
      return;
    }
    
    if (!hasAvailability(day.date)) {
      Alert.alert('אין זמינות', 'ספק השירות לא זמין בתאריך זה');
      return;
    }
    
    setSelectedDate(day.date);
    setSelectedTime(null);
  };

  const handleContinue = () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('בחירה לא שלמה', 'אנא בחר תאריך ושעה');
      return;
    }
    
    setIsNavigating(true);
    
    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const day = selectedDate.getDate();
      
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const hoursStr = String(hours).padStart(2, '0');
      const minutesStr = String(minutes).padStart(2, '0');
      
      const localDate = new Date(year, month, day, hours, minutes);
      const dateTimeISO = localDate.toISOString();
      updateBooking({ 
        dateTime: dateTimeISO,
        duration: localDuration
      });
      
      setTimeout(() => {
        navigation.navigate('BookingSummary', { 
          providerId, 
          providerName,
          selectedDateTime: dateTimeISO
        });
        setIsNavigating(false);
      }, 300);
      
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בשמירת התאריך והשעה');
      setIsNavigating(false);
    }
  };

  const formatSelectedDate = (date) => {
    if (!date) return '';
    
    try {
      const dayOfWeek = getDayName(date.getDay());
      const day = date.getDate();
      const month = getMonthName(date.getMonth());
      const year = date.getFullYear();
      return `יום ${dayOfWeek}, ${day} ב${month} ${year}`;
    } catch (error) {
      return '';
    }
  };

  const serviceLabel = SERVICE_TYPE_LABELS[currentBooking?.serviceType] || SERVICE_TYPE_LABELS.home;
  const selectedSlot = availableSlots.find(s => s.time === selectedTime);
  const todayMidnight = new Date().setHours(0, 0, 0, 0);

  if (isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={[styles.loadingText, styles.textRTL]}>
          טוען זמינות...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="הזמנת ניקיון" onBack={() => navigation.goBack()} style={styles.header} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* BANNIÈRE */}
        <View style={styles.hero}>
          <Ionicons name="sparkles" size={110} color="rgba(255,255,255,0.22)" style={styles.heroArt} />
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{'מרחב רענן\nלימים בהירים'}</Text>
            {providerName ? (
              <View style={styles.heroMeta}>
                <Ionicons name="person-outline" size={13} color={COLORS.white} />
                <Text style={styles.heroMetaText}>{providerName}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 1. DATE */}
        <Text style={[styles.sectionTitle, styles.textRTL]}>1. בחירת תאריך</Text>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => setCurrentDate(new Date())}>
            <Text style={[styles.monthText, styles.textRTL]}>
              {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
            </Text>
          </TouchableOpacity>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={8}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <View style={styles.weekdaysRow}>
            {HEBREW_WEEKDAYS.map((day, index) => (
              <View key={index} style={styles.gridCell}>
                <Text style={styles.weekdayText}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              const isSelected = selectedDate && day.date &&
                day.date.toDateString() === selectedDate.toDateString();
              const isAvailable = day.isCurrentMonth && day.date && hasAvailability(day.date);
              const isPast = day.date && day.date < todayMidnight;
              const isDisabled = !day.isCurrentMonth || isPast || !isAvailable;

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.gridCell}
                  onPress={() => handleDateSelect(day)}
                  disabled={isDisabled}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSelected,
                    isDisabled && styles.dayDisabled,
                  ]}>
                    <Text style={[
                      styles.dayText,
                      day.isToday && styles.dayTextToday,
                      isSelected && styles.dayTextSelected,
                    ]}>
                      {day.day}
                    </Text>
                  </View>
                  {isAvailable && !isSelected && !isPast ? <View style={styles.availabilityDot} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. HEURE */}
        <Text style={[styles.sectionTitle, styles.textRTL]}>2. בחירת שעה</Text>
        {!selectedDate ? (
          <Text style={[styles.hintText, styles.textRTL]}>בחרו תאריך כדי לראות שעות פנויות</Text>
        ) : (
          <>
            <Text style={[styles.hintText, styles.textRTL]}>{formatSelectedDate(selectedDate)}</Text>
            {availableSlots.length === 0 ? (
              <View style={styles.noTimesContainer}>
                <Ionicons name="time-outline" size={32} color={COLORS.accent} />
                <Text key={`no-slots-${localDuration}`} style={styles.noTimesText}>
                  אין משבצות פנויות למשך {localDuration} שעות
                </Text>
                <Text style={styles.noTimesSubtext}>נסה לקצר את משך השירות</Text>
              </View>
            ) : (
              <View style={styles.timesGrid}>
                {availableSlots.map((slot, index) => {
                  const active = selectedTime === slot.time;
                  return (
                    <TouchableOpacity
                      key={`${providerId}_${selectedDate?.toISOString()}_${slot.time}_${index}`}
                      style={[styles.timeItem, active && styles.timeItemActive]}
                      onPress={() => setSelectedTime(slot.time)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.timeText, active && styles.timeTextActive]}>{slot.time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {selectedSlot ? (
              <Text style={[styles.hintText, styles.textRTL]}>
                {selectedSlot.time}–{selectedSlot.endTime}
              </Text>
            ) : null}
          </>
        )}

        {/* 3. DÉTAILS DU SERVICE */}
        <Text style={[styles.sectionTitle, styles.textRTL]}>3. פרטי השירות</Text>
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="home-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.detailBody}>
            <Text style={[styles.detailTitle, styles.textRTL]}>{serviceLabel}</Text>
            <Text key={`duration-${localDuration}`} style={[styles.detailSubtitle, styles.textRTL]}>
              {localDuration === 1 ? 'שעה אחת' : `${localDuration} שעות`}
            </Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepButton, (localDuration >= 50 || isUpdating) && styles.stepButtonDisabled]}
              onPress={() => handleDurationChange(localDuration + 1)}
              disabled={localDuration >= 50 || isUpdating}
            >
              <Ionicons name="add" size={18} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepButton, (localDuration <= 1 || isUpdating) && styles.stepButtonDisabled]}
              onPress={() => handleDurationChange(localDuration - 1)}
              disabled={localDuration <= 1 || isUpdating}
            >
              <Ionicons name="remove" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
        {selectedDate && selectedTime ? (
          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.textHint} />
            <Text style={[styles.noteText, styles.textRTL]}>שינוי המשך יאפס את בחירת המשבצת</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title="המשך לסיכום"
          onPress={handleContinue}
          disabled={!selectedDate || !selectedTime}
          loading={isNavigating}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface },
  loadingText: { marginTop: 12, fontSize: 13, color: COLORS.textMuted },

  header: { paddingTop: TOP_SPACE },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 16, gap: 12 },

  hero: { height: 130, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.accent },
  heroArt: { position: 'absolute', top: 10, left: 16 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,40,62,0.28)' },
  heroContent: { position: 'absolute', top: 18, right: 18, alignItems: 'flex-end', gap: 6 },
  heroTitle: { fontSize: 20, fontWeight: '700', color: COLORS.white, lineHeight: 23, textAlign: 'right' },
  heroMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  heroMetaText: { fontSize: 12, color: COLORS.white },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  hintText: { fontSize: 12, color: COLORS.textMuted },

  monthRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  monthText: { fontSize: 14, color: COLORS.text },
  monthNav: { flexDirection: 'row-reverse', gap: 14 },

  // RTL : dimanche (א׳) à droite
  weekdaysRow: { flexDirection: 'row-reverse', marginBottom: 6 },
  calendarGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  gridCell: { width: '14.28%', alignItems: 'center', paddingVertical: 2 },
  weekdayText: { fontSize: 11, color: COLORS.textHint },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: COLORS.primary },
  dayDisabled: { opacity: 0.3 },
  dayText: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  dayTextToday: { color: COLORS.primary, fontWeight: '700' },
  dayTextSelected: { color: COLORS.white },
  availabilityDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.accent, marginTop: 1 },

  timesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  timeItem: {
    width: '18.6%',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  timeItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: 13, color: COLORS.text },
  timeTextActive: { color: COLORS.white, fontWeight: '600' },
  noTimesContainer: { paddingVertical: 20, alignItems: 'center' },
  noTimesText: { fontSize: 14, color: COLORS.text, textAlign: 'center', marginTop: 10, marginBottom: 4, fontWeight: '500' },
  noTimesSubtext: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },

  detailRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  detailIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.tint, alignItems: 'center', justifyContent: 'center',
  },
  detailBody: { flex: 1 },
  detailTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  detailSubtitle: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  stepper: { flexDirection: 'row-reverse', gap: 6 },
  stepButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.tint, alignItems: 'center', justifyContent: 'center',
  },
  stepButtonDisabled: { opacity: 0.35 },
  noteRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  noteText: { fontSize: 11, color: COLORS.textHint },

  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, backgroundColor: COLORS.surface },

  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ScheduleScreen;
