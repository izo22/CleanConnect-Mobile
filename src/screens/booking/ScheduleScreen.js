// src/screens/booking/ScheduleScreen.js
// ✅ VERSION MODERNE - Navigation intégrée dans le header coloré
// ✅ Plus de barre bleue séparée - tout est dans le rectangle vert

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView, Text } from 'react-native';
import { Card, Title, useTheme, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, getServiceColor } from '../../config/constants';
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
  const theme = useTheme();
  const { currentBooking, updateBooking } = useBooking();
  const { providerId, providerName } = route?.params || {};
  const isRTL = true;
  
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
    return (typeof initial === 'number' && !isNaN(initial) && initial >= 1) ? Math.floor(initial) : 2;
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

  const getStorageKey = (type) => `${type}_${providerId}`;

  const loadAvailabilities = useCallback(async () => {
    if (!providerId) return;
    
    setIsLoadingData(true);
    try {
      const storageKey = getStorageKey('provider_availabilities');
      const savedData = await AsyncStorage.getItem(storageKey);
      
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setAvailabilities(parsedData);
      } else {
        setAvailabilities([]);
      }
    } catch (error) {
      console.error('❌ Error loading availabilities:', error);
      setAvailabilities([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [providerId]);

  const loadBookings = useCallback(async () => {
    try {
      const storageKey = `provider_requests_${providerId}`;
      const savedData = await AsyncStorage.getItem(storageKey);
      
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        const bookings = parsedData.map(req => ({
          id: req._id,
          providerId: providerId,
          date: req.dateTime,
          duration: req.duration,
          status: req.status
        }));
        setExistingBookings(bookings);
      } else {
        setExistingBookings([]);
      }
    } catch (error) {
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
      
      const dateTimeISO = `${year}-${monthStr}-${dayStr}T${hoursStr}:${minutesStr}:00`;
      
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
      console.error('שגיאה ביצירת התאריך:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בשמירת התאריך והשעה');
      setIsNavigating(false);
    }
  };

  const serviceColor = getServiceColor(currentBooking?.serviceType || 'home');

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
    <SafeAreaView style={styles.container}>
      {isLoadingData ? (
        <View style={[styles.loadingContainer, { backgroundColor: serviceColor }]}>
          <ActivityIndicator size="large" color="white" />
          <Text style={[styles.loadingText, styles.textRTL]}>
            טוען זמינות...
          </Text>
        </View>
      ) : (
        <>
          {/* ✅ HEADER MODERNE AVEC NAVIGATION INTÉGRÉE */}
          <View style={[styles.header, { backgroundColor: serviceColor }]}>
            <View style={styles.headerTop}>
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Ionicons name="arrow-forward" size={24} color="white" />
              </TouchableOpacity>
              <Title style={[styles.headerTitle, styles.textRTL]}>בחר משבצת זמן</Title>
              <View style={{ width: 40 }} />
            </View>
          </View>

          <ScrollView>
            <Card style={styles.calendarCard}>
              <Card.Content>
                <Title style={[styles.sectionTitle, styles.textRTL]}>
                  בחר תאריך
                </Title>
                
                <View style={[styles.calendarHeader, styles.rtlRow]}>
                  <TouchableOpacity onPress={() => changeMonth(1)}>
                    <Ionicons name="chevron-forward" size={24} color="#333" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.currentMonthButton}
                    onPress={() => setCurrentDate(new Date())}
                  >
                    <Text style={[styles.currentMonthText, styles.textRTL]}>
                      {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={() => changeMonth(-1)}>
                    <Ionicons name="chevron-back" size={24} color="#333" />
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
                          day.isToday && styles.todayContainer,
                          isSelected && { backgroundColor: serviceColor },
                          (!day.isCurrentMonth || isPast || !isAvailable) && styles.disabledDay
                        ]}
                        onPress={() => handleDateSelect(day)}
                        disabled={!day.isCurrentMonth || isPast || !isAvailable}
                      >
                        <Text style={[
                          styles.dayText,
                          day.isToday && styles.todayText,
                          isSelected && styles.selectedDayText,
                          (!day.isCurrentMonth || isPast || !isAvailable) && styles.disabledDayText,
                          styles.textRTL
                        ]}>
                          {day.day}
                        </Text>
                        {isAvailable && !isSelected && (
                          <View style={[styles.availabilityIndicator, { backgroundColor: serviceColor }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Card.Content>
            </Card>

            <Card style={styles.durationCard}>
              <Card.Content>
                <Title style={[styles.sectionTitle, styles.textRTL]}>
                  משך שירות
                </Title>
                <View style={[styles.durationSelector, styles.rtlRow]}>
                  <TouchableOpacity
                    style={[styles.durationButton, { borderColor: localDuration <= 1 || isUpdating ? '#ccc' : serviceColor }]}
                    onPress={() => handleDurationChange(localDuration - 1)}
                    disabled={localDuration <= 1 || isUpdating}
                  >
                    <Text style={[styles.durationButtonText, { color: localDuration <= 1 || isUpdating ? '#ccc' : serviceColor }]}>-</Text>
                  </TouchableOpacity>
                  
                  <View style={[styles.durationDisplay, { backgroundColor: serviceColor }]}>
                    <Text key={`duration-${localDuration}`} style={[styles.durationText, styles.textRTL]}>
                      {localDuration === 1 ? 'שעה אחת' : `${localDuration} שעות`}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.durationButton, { borderColor: localDuration >= 50 || isUpdating ? '#ccc' : serviceColor }]}
                    onPress={() => handleDurationChange(localDuration + 1)}
                    disabled={localDuration >= 50 || isUpdating}
                  >
                    <Text style={[styles.durationButtonText, { color: localDuration >= 50 || isUpdating ? '#ccc' : serviceColor }]}>+</Text>
                  </TouchableOpacity>
                </View>
                
                {selectedDate && selectedTime && (
                  <View style={[styles.durationNote, styles.rtlRow]}>
                    <Ionicons 
                      name="information-circle-outline" 
                      size={16} 
                      color="#666"
                      style={styles.iconRTL}
                    />
                    <Text style={[styles.durationNoteText, styles.textRTL]}>
                      שינוי המשך יאפס את בחירת המשבצת שלך
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            {selectedDate && (
              <Card style={styles.timesCard}>
                <Card.Content>
                  <Title style={[styles.sectionTitle, styles.textRTL]}>
                    משבצות זמינות
                  </Title>
                  <Text style={[styles.selectedDateText, styles.textRTL]}>
                    {formatSelectedDate(selectedDate)}
                  </Text>
                  
                  <View style={[styles.timesGrid, styles.rtlRow]}>
                    {availableSlots.length === 0 ? (
                      <View style={styles.noTimesContainer}>
                        <Ionicons name="time-outline" size={48} color="#ccc" />
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
                            selectedTime === slot.time && { backgroundColor: serviceColor }
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
                              selectedTime === slot.time && styles.selectedTimeText,
                              styles.textRTL
                            ]}
                          >
                            → {slot.endTime}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </Card.Content>
              </Card>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  { backgroundColor: serviceColor },
                  (!selectedDate || !selectedTime || isNavigating) && styles.disabledButton
                ]}
                onPress={handleContinue}
                disabled={!selectedDate || !selectedTime || isNavigating}
                activeOpacity={0.8}
              >
                {isNavigating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.continueButtonText}>המשך</Text>
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 50 },
  loadingText: { marginTop: 15, fontSize: 16, color: 'white', textAlign: 'center', fontWeight: '500' },
  
  // ✅ HEADER MODERNE AVEC NAVIGATION INTÉGRÉE
  header: { 
    padding: 20, 
    paddingTop: 60,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginLeft: 12,  // ✅ Ajoute cette ligne

  },
  headerTitle: { 
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 8,  // ✅ Ajoute cette ligne

  },
  
  calendarCard: { 
    margin: 16,
    marginBottom: 12, 
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  sectionTitle: { 
    fontSize: 20,
    marginBottom: 16, 
    fontWeight: '700',
    color: '#1F2937',
  },
  
  calendarHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15 },
  currentMonthButton: { padding: 5 },
  currentMonthText: { 
    fontSize: 18, 
    fontWeight: '700',
    color: '#1F2937',
  },
  
  weekdaysContainer: { 
    flexDirection: 'row', 
    paddingVertical: 12,
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6'
  },
  weekdayItem: { flex: 1, alignItems: 'center' },
  weekdayText: { 
    fontSize: 14, 
    fontWeight: '600',
    color: '#6B7280'
  },
  
  calendarGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingVertical: 12,
  },
  dayContainer: { 
    width: '14.28%', 
    aspectRatio: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    position: 'relative', 
    borderRadius: 12,
  },
  dayText: { 
    fontSize: 16, 
    color: '#1F2937',
    fontWeight: '500',
  },
  disabledDay: { opacity: 0.3 },
  disabledDayText: { color: '#D1D5DB' },
  todayContainer: { backgroundColor: '#DBEAFE' },
  todayText: { 
    fontWeight: '700',
  },
  selectedDayText: { 
    color: 'white', 
    fontWeight: '700'
  },
  availabilityIndicator: { 
    position: 'absolute', 
    bottom: 3,
    width: 6, 
    height: 6, 
    borderRadius: 3, 
  },
  
  durationCard: { 
    margin: 16, 
    marginBottom: 12, 
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  durationSelector: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 12,
  },
  durationButton: { 
    width: 52,
    height: 52, 
    borderRadius: 26,
    borderWidth: 2, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  durationButtonText: { 
    fontSize: 28, 
    fontWeight: '700'
  },
  durationDisplay: { 
    paddingHorizontal: 28,
    paddingVertical: 14, 
    marginHorizontal: 20, 
    borderRadius: 12,
  },
  durationText: { 
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
  },
  durationNote: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 14,
    paddingTop: 14, 
    borderTopWidth: 1, 
    borderTopColor: '#F3F4F6'
  },
  durationNoteText: { 
    fontSize: 12, 
    color: '#6B7280',
    marginRight: 6 
  },
  
  timesCard: { 
    margin: 16, 
    marginTop: 6, 
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  selectedDateText: { 
    fontSize: 14, 
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  timesGrid: { 
    flexDirection: 'row-reverse', 
    flexWrap: 'wrap', 
    justifyContent: 'flex-start',
    gap: 10,
  },
  timeItem: { 
    width: '30%', 
    marginHorizontal: '1.5%', 
    marginBottom: 12, 
    padding: 14,
    borderRadius: 12,
    elevation: 2, 
    alignItems: 'center', 
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  timeText: { 
    fontSize: 15, 
    fontWeight: '700',
    color: '#1F2937',
  },
  timeEndText: { 
    fontSize: 12, 
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  selectedTimeText: { color: 'white' },
  noTimesContainer: { padding: 32, alignItems: 'center', width: '100%' },
  noTimesText: { 
    fontSize: 16, 
    color: '#6B7280',
    textAlign: 'center', 
    marginTop: 12, 
    marginBottom: 6,
    fontWeight: '600'
  },
  noTimesSubtext: { 
    fontSize: 14, 
    color: '#9CA3AF',
    textAlign: 'center' 
  },
  
  buttonContainer: { padding: 16, marginBottom: 32 },
  continueButton: { 
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
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