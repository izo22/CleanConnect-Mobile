// src/screens/booking/ScheduleScreen.js - ✅ VERSION FINALE CORRIGÉE (TOUS BUGS RÉSOLUS)
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { Text, Card, Title, Button, useTheme, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS } from '../../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 📅 UTILITAIRES CALENDRIER
const getDaysInMonth = (year, month) => {
  const date = new Date(year, month, 1);
  const days = [];
  const firstDayOfMonth = date.getDay();
  
  for (let i = 0; i < firstDayOfMonth; i++) {
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
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

const getMonthName = (month) => {
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return monthNames[month];
};

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const ScheduleScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const { currentBooking, updateBooking } = useBooking();
  const { providerId, providerName } = route?.params || {};
  
  // États
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false); // Protection contre clics rapides
  
  // ✅ FIX CRASH: État local pour affichage immédiat + sync avec contexte
  const [localDuration, setLocalDuration] = useState(() => {
    const initial = currentBooking?.duration;
    return (typeof initial === 'number' && !isNaN(initial) && initial >= 1) ? Math.floor(initial) : 2;
  });

  // ✅ Sync quand le contexte change (de l'extérieur)
  useEffect(() => {
    if (currentBooking?.duration && currentBooking.duration !== localDuration) {
      const value = currentBooking.duration;
      const validDuration = (typeof value === 'number' && !isNaN(value) && value >= 1) ? Math.floor(value) : 2;
      setLocalDuration(validDuration);
    }
  }, [currentBooking?.duration]);

  // ✅ FIX CRASH: Fonction de changement avec React.startTransition pour batching
  const handleDurationChange = useCallback((newDuration) => {
    // 🛡️ Bloquer les clics multiples rapides
    if (isUpdating) {
      return;
    }
    
    
    // 🛡️ Validation complète
    if (typeof newDuration !== 'number' || isNaN(newDuration)) {
      return;
    }
    
    if (newDuration < 1) {
      return;
    }
    
    if (newDuration > 50) {
      return;
    }
    
    const validDuration = Math.floor(newDuration);
    
    // ✅ Activer le flag
    setIsUpdating(true);
    
    // ✅ Batch toutes les mises à jour ensemble pour éviter re-renders multiples
    requestAnimationFrame(() => {
      // Tout dans un seul cycle de rendu
      setSelectedTime(null);
      setLocalDuration(validDuration);
      updateBooking({ duration: validDuration });
      
      // ✅ Désactiver le flag après un délai
      setTimeout(() => {
        setIsUpdating(false);
      }, 100);
    });
  }, [updateBooking, localDuration, isUpdating]);

  // 🔑 CLÉ DE STOCKAGE
  const getStorageKey = (type) => `${type}_${providerId}`;

  // 🔄 CHARGER LES DISPONIBILITÉS
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
      setAvailabilities([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [providerId]);

  // 🔄 CHARGER LES RÉSERVATIONS EXISTANTES
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

  // 🔧 VÉRIFIER DISPONIBILITÉ
  const hasAvailability = useMemo(() => {
    return (date) => {
      if (!date || !availabilities.length) {
        return false;
      }
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

  // ⏰ CALCUL CRÉNEAUX - ✅ CORRECTION COMPLÈTE
  const calculateSlots = useCallback((targetDate, currentDuration) => {
      date: targetDate?.toLocaleDateString('fr-FR'), 
      duration: currentDuration,
      availabilitiesCount: availabilities.length,
      bookingsCount: existingBookings.length
    });
    
    // 🛡️ Validation d'entrée
    if (!targetDate) {
      return [];
    }
    
    if (!currentDuration || currentDuration < 1) {
      return [];
    }
    
    const formattedDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    const dayOfWeek = targetDate.getDay();
    
    // 🔍 Trouver les disponibilités pour cette date
    const dayAvailabilities = availabilities.filter(av => {
      if (av.isRecurring) {
        return av.dayOfWeek === dayOfWeek && av.status === 'available';
      } else {
        return av.date === formattedDate && av.status === 'available';
      }
    });
    
    
    if (dayAvailabilities.length === 0) {
      return [];
    }
    
    // 📚 Réservations pour cette date
    const dateBookings = existingBookings.filter(booking => {
      const bookingDate = new Date(booking.date);
      return bookingDate.toDateString() === targetDate.toDateString() && 
             booking.status !== 'cancelled';
    });
    
    
    // ⏰ Générer tous les créneaux possibles
    const allSlots = [];
    
    dayAvailabilities.forEach(av => {
      const [startHour, startMinute] = av.startTime.split(':').map(Number);
      const [endHour, endMinute] = av.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const durationMinutes = currentDuration * 60;
      
      // Générer créneaux de 30 minutes
      for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += 30) {
        const slotHour = Math.floor(minutes / 60);
        const slotMinute = minutes % 60;
        const slotEndMinutes = minutes + durationMinutes;
        const slotEndHour = Math.floor(slotEndMinutes / 60);
        const slotEndMinute = slotEndMinutes % 60;
        
        const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`;
        const slotEndTime = `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMinute).padStart(2, '0')}`;
        
        // 🔍 Vérifier les conflits avec réservations existantes
        const hasConflict = dateBookings.some(booking => {
          const bookingStart = new Date(booking.date);
          const bookingStartMinutes = bookingStart.getHours() * 60 + bookingStart.getMinutes();
          const bookingEndMinutes = bookingStartMinutes + (booking.duration * 60);
          
          // Conflit si chevauchement
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
    
    // Trier par heure
    allSlots.sort((a, b) => a.minutes - b.minutes);
    
    return allSlots;
  }, [availabilities, existingBookings]);

  // 🔄 Recalculer créneaux quand durée, date ou données changent
  useEffect(() => {
    if (selectedDate && localDuration) {
      const slots = calculateSlots(selectedDate, localDuration);
      setAvailableSlots(slots);
    } else {
      setAvailableSlots([]);
    }
  }, [selectedDate, localDuration, calculateSlots]);

  // 📅 Initialiser le calendrier au chargement
  useEffect(() => {
    const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    setCalendarDays(days);
  }, [currentDate]);

  // 🔄 Charger données au montage
  useEffect(() => {
    loadAvailabilities();
    loadBookings();
  }, [loadAvailabilities, loadBookings]);

  // 🗓️ Navigation mois
  const changeMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  // 📅 Sélection de date
  const handleDateSelect = (day) => {
    if (!day.isCurrentMonth || !day.date) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDay = new Date(day.date);
    selectedDay.setHours(0, 0, 0, 0);
    
    if (selectedDay < today) {
      Alert.alert('Date invalide', 'Veuillez sélectionner une date future');
      return;
    }
    
    if (!hasAvailability(day.date)) {
      Alert.alert('Pas de disponibilité', 'Le prestataire n\'est pas disponible ce jour');
      return;
    }
    
    setSelectedDate(day.date);
    setSelectedTime(null);
  };

  // ➡️ Continuer vers récapitulatif
  const handleContinue = () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Sélection incomplète', 'Veuillez sélectionner une date et un créneau');
      return;
    }
    
    setIsNavigating(true);
    
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const dateTime = new Date(selectedDate);
    dateTime.setHours(hours, minutes, 0, 0);
    
    updateBooking({ 
      dateTime: dateTime.toISOString(),
      duration: localDuration // S'assurer que la durée est bien enregistrée
    });
    
      dateTime: dateTime.toISOString(),
      duration: localDuration,
      providerId,
      providerName
    });
    
    setTimeout(() => {
      navigation.navigate('BookingSummary', { providerId, providerName });
      setIsNavigating(false);
    }, 500);
  };

  // 🎨 Couleur selon service
  const serviceColor = currentBooking?.serviceType === 'home' ? '#007AFF' :
                       currentBooking?.serviceType === 'office' ? '#34C759' : '#FF9500';

  return (
    <SafeAreaView style={styles.container}>
      {isLoadingData ? (
        // 🔄 Écran de chargement
        <View style={[styles.loadingContainer, { backgroundColor: serviceColor }]}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>Chargement des disponibilités...</Text>
          <Text style={styles.providerIdText}>Provider ID: {providerId}</Text>
        </View>
      ) : (
        // 📅 Écran principal
        <>
          <View style={[styles.header, { backgroundColor: serviceColor }]}>
            <Title style={styles.headerTitle}>Choisir un créneau</Title>
            <Text style={styles.headerSubtitle}>{providerName}</Text>
            <Text style={styles.headerNote}>
              {SERVICE_TYPE_LABELS[currentBooking?.serviceType] || 'Service'}
            </Text>
          </View>

          <ScrollView>
            {/* CALENDRIER */}
            <Card style={styles.calendarCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Sélectionner une date</Title>
            
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)}>
                <Ionicons name="chevron-back" size={24} color="#333" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.currentMonthButton}
                onPress={() => setCurrentDate(new Date())}
              >
                <Text style={styles.currentMonthText}>
                  {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => changeMonth(1)}>
                <Ionicons name="chevron-forward" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdaysContainer}>
              {WEEKDAYS.map((day, index) => (
                <View key={index} style={styles.weekdayItem}>
                  <Text style={styles.weekdayText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.calendarContainer}>
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
                      (!day.isCurrentMonth || isPast || !isAvailable) && styles.disabledDayText
                    ]}>
                      {day.day}
                    </Text>
                    {isAvailable && !isSelected && (
                      <View style={styles.availabilityIndicator} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card.Content>
        </Card>

        {/* SÉLECTEUR DURÉE - ✅ FIX BUG #1, #2, #3 */}
        <Card style={styles.durationCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Durée du service</Title>
            <View style={styles.durationSelector}>
              <TouchableOpacity
                style={[styles.durationButton, { borderColor: localDuration <= 1 || isUpdating ? '#ccc' : serviceColor }]}
                onPress={() => handleDurationChange(localDuration - 1)}
                disabled={localDuration <= 1 || isUpdating}
              >
                <Text style={[styles.durationButtonText, { color: localDuration <= 1 || isUpdating ? '#ccc' : serviceColor }]}>-</Text>
              </TouchableOpacity>
              
              <View style={[styles.durationDisplay, { backgroundColor: serviceColor + '20' }]}>
                <Text key={`duration-${localDuration}`} style={styles.durationText}>
                  {localDuration} heure{localDuration > 1 ? 's' : ''}
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
              <View style={styles.durationNote}>
                <Ionicons name="information-circle-outline" size={16} color="#666" />
                <Text style={styles.durationNoteText}>
                  Changer la durée réinitialisera votre sélection de créneau
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* CRÉNEAUX DISPONIBLES - ✅ AFFICHAGE DYNAMIQUE */}
        {selectedDate && (
          <Card style={styles.timesCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Créneaux disponibles</Title>
              <Text key={`selected-date-${selectedDate?.toISOString()}`} style={styles.selectedDateText}>
                {selectedDate.toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </Text>
              
              <View style={styles.timesGrid}>
                {availableSlots.length === 0 ? (
                  <View style={styles.noTimesContainer}>
                    <Ionicons name="time-outline" size={48} color="#ccc" />
                    <Text key={`no-slots-${localDuration}`} style={styles.noTimesText}>
                      Aucun créneau de {localDuration}h disponible
                    </Text>
                    <Text style={styles.noTimesSubtext}>
                      Essayez une durée plus courte ou une autre date
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
                        key={`time-${slot.time}-${index}`}
                        style={[
                          styles.timeText,
                          selectedTime === slot.time && styles.selectedTimeText
                        ]}
                      >
                        {slot.time}
                      </Text>
                      <Text 
                        key={`endtime-${slot.endTime}-${index}`}
                        style={[
                          styles.timeEndText,
                          selectedTime === slot.time && styles.selectedTimeText
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

        {/* BOUTON CONTINUER */}
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            style={[styles.continueButton, { backgroundColor: serviceColor }]}
            onPress={handleContinue}
            disabled={!selectedDate || !selectedTime || isNavigating}
            loading={isNavigating}
          >
            {isNavigating ? 'Redirection...' : 'Continuer'}
          </Button>
        </View>
      </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 50 },
  loadingText: { marginTop: 15, fontSize: 16, color: 'white', textAlign: 'center', fontWeight: '500' },
  providerIdText: { marginTop: 5, fontSize: 12, color: 'white', opacity: 0.8 },
  
  header: { padding: 20, paddingTop: 40, paddingBottom: 30 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 16, color: 'white', opacity: 0.8, marginTop: 4 },
  headerNote: { fontSize: 12, color: 'white', opacity: 0.9, marginTop: 8 },
  
  calendarCard: { margin: 15, marginBottom: 10, borderRadius: 8, elevation: 4 },
  sectionTitle: { fontSize: 18, marginBottom: 15, fontWeight: '600' },
  
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15 },
  currentMonthButton: { padding: 5 },
  currentMonthText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  
  weekdaysContainer: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  weekdayItem: { flex: 1, alignItems: 'center' },
  weekdayText: { fontSize: 14, fontWeight: '500', color: '#666' },
  
  calendarContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 10 },
  dayContainer: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', position: 'relative', borderRadius: 8, margin: 1 },
  dayText: { fontSize: 16, color: '#333' },
  disabledDay: { opacity: 0.3 },
  disabledDayText: { color: '#ccc' },
  todayContainer: { backgroundColor: '#E3F2FD' },
  todayText: { color: '#007AFF', fontWeight: 'bold' },
  selectedDayContainer: { borderRadius: 15 },
  selectedDayText: { color: 'white', fontWeight: 'bold' },
  availabilityIndicator: { position: 'absolute', bottom: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  
  durationCard: { margin: 15, marginBottom: 10, borderRadius: 8, elevation: 4 },
  durationSelector: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  durationButton: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  durationButtonText: { fontSize: 28, fontWeight: 'bold' },
  durationDisplay: { paddingHorizontal: 25, paddingVertical: 12, marginHorizontal: 20, borderRadius: 8 },
  durationText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  durationNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  durationNoteText: { fontSize: 12, color: '#666', marginLeft: 6 },
  
  timesCard: { margin: 15, marginTop: 5, borderRadius: 8, elevation: 4 },
  selectedDateText: { fontSize: 14, color: '#666', marginBottom: 15, textAlign: 'center', textTransform: 'capitalize' },
  timesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  timeItem: { width: '30%', marginHorizontal: '1.5%', marginBottom: 12, padding: 12, borderRadius: 8, elevation: 2, alignItems: 'center', backgroundColor: '#f0f0f0' },
  timeText: { fontSize: 15, fontWeight: '600' },
  timeEndText: { fontSize: 12, color: '#666', marginTop: 4 },
  selectedTimeText: { color: 'white' },
  noTimesContainer: { padding: 30, alignItems: 'center', width: '100%' },
  noTimesText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 12, marginBottom: 5, fontWeight: '500' },
  noTimesSubtext: { fontSize: 14, color: '#999', textAlign: 'center' },
  
  buttonContainer: { padding: 15, marginBottom: 30 },
  continueButton: { paddingVertical: 8 },
});

export default ScheduleScreen;
