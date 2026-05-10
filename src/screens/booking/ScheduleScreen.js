// src/screens/booking/ScheduleScreen.js
// ✅ VERSION CORRIGÉE : Charge les disponibilités du prestataire depuis le backend

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView, Text } from 'react-native';
import { useTheme, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, getServiceColor, getServiceBackgroundColor, API_URL } from '../../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
  const theme = useTheme();
  const { currentBooking, updateBooking } = useBooking();
  // ✅ MODIFIÉ : ajout de providerBio
  const { providerId, providerName, providerBio } = route?.params || {};
  const isRTL = true;
  
  const serviceColor = getServiceColor(currentBooking?.serviceType || 'home');
  const serviceBgColor = getServiceBackgroundColor(currentBooking?.serviceType || 'home');
  
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: serviceBgColor }]}>
      {isLoadingData ? (
        <View style={[styles.loadingContainer, { backgroundColor: serviceBgColor }]}>
          <ActivityIndicator size="small" color={serviceColor} />
          <Text style={[styles.loadingText, styles.textRTL]}>
            טוען זמינות...
          </Text>
        </View>
      ) : (
        <>
          {/* HEADER MINIMALISTE BLANC */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Ionicons name="arrow-forward" size={20} color="#1F2937" />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, styles.textRTL]}>בחר משבצת זמן</Text>
              <View style={{ width: 40 }} />
            </View>
          </View>

          {/* ✅ AJOUT : BIO COMPLÈTE DU PRESTATAIRE */}
          {providerBio ? (
            <View style={styles.bioCard}>
              <Text style={[styles.bioText, styles.textRTL]}>{providerBio}</Text>
            </View>
          ) : null}

          <ScrollView style={{ backgroundColor: serviceBgColor }}>
            {/* CALENDAR CARD */}
            <View style={styles.calendarCard}>
              <Text style={[styles.sectionLabel, styles.textRTL]}>
                בחר תאריך
              </Text>
              
              <View style={[styles.calendarHeader, styles.rtlRow]}>
                <TouchableOpacity 
                  onPress={() => changeMonth(1)}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-forward" size={20} color="#1F2937" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.currentMonthButton}
                  onPress={() => setCurrentDate(new Date())}
                >
                  <Text style={[styles.currentMonthText, styles.textRTL]}>
                    {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => changeMonth(-1)}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-back" size={20} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <View style={styles.weekdaysContainer}>
                {HEBREW_WEEKDAYS.map((day, index) => (
                  <View key={index} style={styles.weekdayItem}>
                    <Text style={[styles.weekdayText, styles.textRTL]}>{day}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((day, index) => {
                  const isSelected = selectedDate && day.date && 
                    day.date.toDateString() === selectedDate.toDateString();
                  const isAvailable = day.isCurrentMonth && day.date && hasAvailability(day.date);
                  const isPast = day.date && day.date < new Date().setHours(0, 0, 0, 0);
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayContainer,
                        day.isToday && { backgroundColor: `${serviceColor}08` },
                        isSelected && { backgroundColor: serviceColor },
                        (!day.isCurrentMonth || isPast || !isAvailable) && styles.disabledDay
                      ]}
                      onPress={() => handleDateSelect(day)}
                      disabled={!day.isCurrentMonth || isPast || !isAvailable}
                    >
                      <Text style={[
                        styles.dayText,
                        day.isToday && { color: serviceColor, fontWeight: '600' },
                        isSelected && styles.selectedDayText,
                        (!day.isCurrentMonth || isPast || !isAvailable) && styles.disabledDayText,
                        styles.textRTL
                      ]}>
                        {day.day}
                      </Text>
                      {isAvailable && !isSelected && !day.isToday && (
                        <View style={[styles.availabilityDot, { backgroundColor: serviceColor }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* DURATION CARD */}
            <View style={styles.durationCard}>
              <Text style={[styles.sectionLabel, styles.textRTL]}>
                משך שירות
              </Text>
              
              <View style={[styles.durationSelector, styles.rtlRow]}>
                <TouchableOpacity
                  style={[
                    styles.durationButton,
                    { borderColor: localDuration <= 1 || isUpdating ? '#E5E7EB' : serviceColor }
                  ]}
                  onPress={() => handleDurationChange(localDuration - 1)}
                  disabled={localDuration <= 1 || isUpdating}
                >
                  <Icon 
                    name="minus" 
                    size={18} 
                    color={localDuration <= 1 || isUpdating ? '#D1D5DB' : serviceColor}
                  />
                </TouchableOpacity>
                
                <View style={[styles.durationDisplay, { backgroundColor: `${serviceColor}10` }]}>
                  <Text 
                    key={`duration-${localDuration}`} 
                    style={[styles.durationText, { color: serviceColor }, styles.textRTL]}
                  >
                    {localDuration === 1 ? 'שעה אחת' : `${localDuration} שעות`}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.durationButton,
                    { borderColor: localDuration >= 50 || isUpdating ? '#E5E7EB' : serviceColor }
                  ]}
                  onPress={() => handleDurationChange(localDuration + 1)}
                  disabled={localDuration >= 50 || isUpdating}
                >
                  <Icon 
                    name="plus" 
                    size={18} 
                    color={localDuration >= 50 || isUpdating ? '#D1D5DB' : serviceColor}
                  />
                </TouchableOpacity>
              </View>
              
              {selectedDate && selectedTime && (
                <View style={[styles.durationNote, styles.rtlRow]}>
                  <Ionicons 
                    name="information-circle-outline" 
                    size={14} 
                    color="#9CA3AF"
                    style={styles.iconRTL}
                  />
                  <Text style={[styles.durationNoteText, styles.textRTL]}>
                    שינוי המשך יאפס את בחירת המשבצת
                  </Text>
                </View>
              )}
            </View>

            {/* TIME SLOTS */}
            {selectedDate && (
              <View style={styles.timesCard}>
                <Text style={[styles.sectionLabel, styles.textRTL]}>
                  משבצות זמינות
                </Text>
                <Text style={[styles.selectedDateText, styles.textRTL]}>
                  {formatSelectedDate(selectedDate)}
                </Text>
                
                <View style={[styles.timesGrid, styles.rtlRow]}>
                  {availableSlots.length === 0 ? (
                    <View style={styles.noTimesContainer}>
                      <Icon name="clock-outline" size={40} color="#D1D5DB" />
                      <Text key={`no-slots-${localDuration}`} style={[styles.noTimesText, styles.textRTL]}>
                        אין משבצות פנויות למשך {localDuration} שעות
                      </Text>
                      <Text style={[styles.noTimesSubtext, styles.textRTL]}>
                        נסה לקצר את משך השירות
                      </Text>
                    </View>
                  ) : (
                    availableSlots.map((slot, index) => (
                      <TouchableOpacity
                        key={`${providerId}_${selectedDate?.toISOString()}_${slot.time}_${index}`}
                        style={[
                          styles.timeItem,
                          selectedTime === slot.time && { 
                            backgroundColor: serviceColor,
                            borderColor: serviceColor
                          }
                        ]}
                        onPress={() => setSelectedTime(slot.time)}
                      >
                        <Text 
                          style={[
                            styles.timeText,
                            selectedTime === slot.time && styles.selectedTimeText,
                            styles.textRTL
                          ]}
                        >
                          {slot.time}
                        </Text>
                        <Text 
                          style={[
                            styles.timeEndText,
                            selectedTime === slot.time && styles.selectedTimeEndText,
                            styles.textRTL
                          ]}
                        >
                          - {slot.endTime}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: serviceColor },
                  (!selectedDate || !selectedTime || isNavigating) && styles.buttonDisabled
                ]}
                onPress={handleContinue}
                disabled={!selectedDate || !selectedTime || isNavigating}
                activeOpacity={0.8}
              >
                {isNavigating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.primaryButtonText, styles.textRTL]}>המשך</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  loadingText: { 
    marginTop: 12, 
    fontSize: 13, 
    color: '#9CA3AF',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  
  header: { 
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: { 
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
    letterSpacing: -0.3,
  },

  // ✅ AJOUT : styles bio
  bioCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  bioText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    fontWeight: '400',
  },
  
  calendarCard: { 
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16, 
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sectionLabel: { 
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  
  calendarHeader: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  currentMonthButton: { 
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currentMonthText: { 
    fontSize: 15, 
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  
  weekdaysContainer: { 
    flexDirection: 'row', 
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  weekdayItem: { 
    flex: 1, 
    alignItems: 'center',
  },
  weekdayText: { 
    fontSize: 12, 
    fontWeight: '500',
    color: '#9CA3AF',
    letterSpacing: -0.2,
  },
  
  calendarGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
  },
  dayContainer: { 
    width: '14.28%', 
    aspectRatio: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    position: 'relative', 
    borderRadius: 8,
    marginBottom: 4,
  },
  dayText: { 
    fontSize: 14, 
    color: '#1F2937',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  disabledDay: { 
    opacity: 0.25,
  },
  disabledDayText: { 
    color: '#D1D5DB',
  },
  selectedDayText: { 
    color: 'white', 
    fontWeight: '600',
  },
  availabilityDot: { 
    position: 'absolute', 
    bottom: 4,
    width: 4, 
    height: 4, 
    borderRadius: 2, 
  },
  
  durationCard: { 
    marginHorizontal: 16,
    marginBottom: 16, 
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  durationSelector: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  durationButton: { 
    width: 40,
    height: 40, 
    borderRadius: 8,
    borderWidth: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  durationDisplay: { 
    paddingHorizontal: 20,
    paddingVertical: 10, 
    marginHorizontal: 16, 
    borderRadius: 8,
  },
  durationText: { 
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  durationNote: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 12,
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#F3F4F6',
  },
  durationNoteText: { 
    fontSize: 11, 
    color: '#9CA3AF',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  
  timesCard: { 
    marginHorizontal: 16,
    marginBottom: 16, 
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  selectedDateText: { 
    fontSize: 12, 
    color: '#9CA3AF',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  timesGrid: { 
    flexDirection: 'row-reverse', 
    flexWrap: 'wrap',
    gap: 8,
  },
  timeItem: { 
    width: '31%', 
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center', 
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeText: { 
    fontSize: 14, 
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.2,
  },
  timeEndText: { 
    fontSize: 11, 
    color: '#9CA3AF',
    marginTop: 2,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  selectedTimeText: { 
    color: 'white',
  },
  selectedTimeEndText: {
    color: 'rgba(255,255,255,0.8)',
  },
  noTimesContainer: { 
    padding: 32, 
    alignItems: 'center', 
    width: '100%',
  },
  noTimesText: { 
    fontSize: 14, 
    color: '#6B7280',
    textAlign: 'center', 
    marginTop: 12, 
    marginBottom: 4,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  noTimesSubtext: { 
    fontSize: 12, 
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  
  buttonContainer: { 
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  primaryButton: { 
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  iconRTL: {
    marginLeft: 6,
    marginRight: 0,
  },
});

export default ScheduleScreen;