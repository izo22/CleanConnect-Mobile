// CalendarScreen.js - FIXED avec synchronisation backend des disponibilités
import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServiceColor } from '../../config/constants';
import providerAvailabilityService from '../../services/providerAvailabilityService';

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

const INITIAL_MOCK_AVAILABILITIES = [];
const MOCK_JOBS = [];

const CalendarScreen = ({ navigation, route }) => {
  const serviceType = route.params?.serviceType || 'home';
  const serviceColor = getServiceColor(serviceType);
  
  const [providerId, setProviderId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingAvailabilities, setIsLoadingAvailabilities] = useState(true);
  
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [modalDate, setModalDate] = useState(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [isRecurring, setIsRecurring] = useState(false);

  const getMonthName = (month) => {
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return months[month];
  };

  const WEEKDAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        const role = await AsyncStorage.getItem('userRole');
        
        if (userData) {
          const user = JSON.parse(userData);
          setProviderId(user.id);
          setUserRole(role);
        }
      } catch (error) {
        console.error('❌ Erreur chargement userInfo:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };
    
    loadUserInfo();
  }, []);

  // ✅ NOUVEAU: Charger les disponibilités depuis le backend
  const loadAvailabilities = async () => {
    if (!providerId) return;
    
    setIsLoadingAvailabilities(true);
    try {
      console.log('📥 Chargement des disponibilités depuis le backend...');
      
      const result = await providerAvailabilityService.fetchAvailabilities();
      
      if (result.success && result.data) {
        setAvailabilities(result.data);
        console.log(`✅ ${result.data.length} disponibilités chargées`);
      } else {
        console.log('⚠️ Aucune disponibilité trouvée');
        setAvailabilities([]);
      }
    } catch (error) {
      console.error('❌ Erreur loadAvailabilities:', error);
      Alert.alert('Erreur', 'Impossible de charger les disponibilités');
      setAvailabilities([]);
    } finally {
      setIsLoadingAvailabilities(false);
    }
  };

  useEffect(() => {
    if (providerId) {
      loadAvailabilities();
    }
  }, [providerId]);

  const hasJobs = useMemo(() => {
    const jobDates = new Set();
    MOCK_JOBS.forEach(job => {
      const jobDate = new Date(job.date);
      const key = `${jobDate.getFullYear()}-${String(jobDate.getMonth() + 1).padStart(2, '0')}-${String(jobDate.getDate()).padStart(2, '0')}`;
      jobDates.add(key);
    });
    
    return (date) => {
      if (!date) return false;
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return jobDates.has(formattedDate);
    };
  }, []);

  const hasAvailability = useMemo(() => {
    return (date) => {
      if (!date) return false;
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayOfWeek = date.getDay();
      
      return availabilities.some(av => {
        if (av.isRecurring) {
          return av.dayOfWeek === dayOfWeek;
        } else {
          return av.date === formattedDate;
        }
      });
    };
  }, [availabilities]);

  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    setCalendarDays(getDaysInMonth(year, month));
  }, [currentDate]);

  useEffect(() => {
    if (selectedDate) {
      loadJobsForDate(selectedDate);
    } else {
      setJobs([]);
      setLoading(false);
    }
  }, [selectedDate]);

  const loadJobsForDate = async (date) => {
    setLoading(true);
    
    setTimeout(() => {
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const filteredJobs = MOCK_JOBS.filter(job => {
        const jobDate = new Date(job.date);
        const jobFormattedDate = `${jobDate.getFullYear()}-${String(jobDate.getMonth() + 1).padStart(2, '0')}-${String(jobDate.getDate()).padStart(2, '0')}`;
        return jobFormattedDate === formattedDate;
      });
      
      setJobs(filteredJobs);
      setLoading(false);
    }, 500);
  };

  const getAvailabilitiesForDate = (date) => {
    if (!date) return [];
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayOfWeek = date.getDay();
    
    return availabilities.filter(av => {
      if (av.isRecurring) {
        return av.dayOfWeek === dayOfWeek;
      } else {
        return av.date === formattedDate;
      }
    });
  };

  const handleAddAvailability = (date = null) => {
    const targetDate = date || selectedDate;
    if (!targetDate) return;
    setModalDate(targetDate);
    setShowAvailabilityModal(true);
  };

  // ✅ MODIFIÉ: Ajouter une disponibilité avec synchronisation backend
  const addAvailability = async () => {
    if (!modalDate || !startTime || !endTime) {
      Alert.alert('שגיאה', 'יש למלא את כל השדות');
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert('שגיאה', 'פורמט שעה לא תקין. השתמש בפורמט HH:MM (לדוגמה: 09:00)');
      return;
    }

    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    if (startTotalMinutes >= endTotalMinutes) {
      Alert.alert('שגיאה', 'שעת הסיום חייבת להיות אחרי שעת ההתחלה');
      return;
    }

    const newAvailability = {
      id: `av_${Date.now()}`,
      date: isRecurring ? undefined : `${modalDate.getFullYear()}-${String(modalDate.getMonth() + 1).padStart(2, '0')}-${String(modalDate.getDate()).padStart(2, '0')}`,
      dayOfWeek: isRecurring ? modalDate.getDay() : undefined,
      startTime,
      endTime,
      isRecurring,
      status: 'available'
    };

    try {
      console.log('💾 Ajout de la disponibilité...');
      
      // ✅ Sauvegarder sur le backend via le service
      const result = await providerAvailabilityService.addAvailability(availabilities, newAvailability);
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      setAvailabilities(result.data);
      
      setShowAvailabilityModal(false);
      setStartTime('09:00');
      setEndTime('17:00');
      setIsRecurring(false);
      
      Alert.alert('הצלחה', 'הזמינות נוספה בהצלחה');
      
    } catch (error) {
      console.error('❌ Erreur ajout disponibilité:', error);
      Alert.alert('שגיאה', 'שגיאה בשמירת הזמינות: ' + error.message);
    }
  };

  // ✅ MODIFIÉ: Supprimer une disponibilité avec synchronisation backend
  const deleteAvailability = async (availabilityId) => {
    Alert.alert(
      'מחיקת זמינות',
      'האם אתה בטוח שברצונך למחוק זמינות זו?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Suppression de la disponibilité...');
              
              // ✅ Supprimer sur le backend via le service
              const result = await providerAvailabilityService.deleteAvailability(availabilities, availabilityId);
              
              if (!result.success) {
                throw new Error(result.message);
              }
              
              setAvailabilities(result.data);
              
              Alert.alert('הצלחה', 'הזמינות נמחקה בהצלחה');
              
            } catch (error) {
              console.error('❌ Erreur suppression disponibilité:', error);
              Alert.alert('שגיאה', 'שגיאה במחיקת הזמינות: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const goToPreviousMonth = () => {
    const previousMonth = new Date(currentDate);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    setCurrentDate(previousMonth);
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentDate(nextMonth);
    setSelectedDate(null);
  };

  const goToCurrentMonth = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleDayPress = (day) => {
    if (!day.isCurrentMonth || !day.date) return;
    setSelectedDate(day.date);
  };

  if (isAuthLoading || isLoadingAvailabilities) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={serviceColor} />
        <Text style={[styles.loadingText, styles.textRTL]}>טוען נתונים...</Text>
      </View>
    );
  }

  const dateAvailabilities = selectedDate ? getAvailabilitiesForDate(selectedDate) : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.headerRow, styles.rtlRow]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-forward" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.textRTL]}>לוח זמנים</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Calendar Header */}
        <View style={[styles.calendarHeader, styles.rtlRow]}>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color="#111827" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.monthButton} onPress={goToCurrentMonth}>
            <Text style={[styles.monthText, styles.textRTL]}>
              {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Weekdays */}
        <View style={styles.weekdaysRow}>
          {WEEKDAYS.map((day, index) => (
            <View key={index} style={styles.weekdayCell}>
              <Text style={[styles.weekdayText, styles.textRTL]}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            const isSelected = selectedDate && day.date && 
              day.date.toDateString() === selectedDate.toDateString();
            const isAvailable = day.isCurrentMonth && day.date && hasAvailability(day.date);
            const hasJob = day.isCurrentMonth && day.date && hasJobs(day.date);
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  day.isToday && { borderColor: serviceColor, borderWidth: 1.5 },
                  isSelected && [styles.selectedDay, { backgroundColor: serviceColor }],
                  !day.isCurrentMonth && styles.disabledDay
                ]}
                onPress={() => handleDayPress(day)}
                disabled={!day.isCurrentMonth}
              >
                <Text style={[
                  styles.dayText,
                  day.isToday && !isSelected && { color: serviceColor, fontWeight: '600' },
                  isSelected && styles.selectedDayText,
                  !day.isCurrentMonth && styles.disabledDayText,
                  styles.textRTL
                ]}>
                  {day.day}
                </Text>
                {isAvailable && !isSelected && (
                  <View style={[styles.dot, { backgroundColor: serviceColor }]} />
                )}
                {hasJob && (
                  <View style={[styles.jobDot, { backgroundColor: '#10B981' }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Date Details */}
        {selectedDate && (
          <View style={styles.detailsCard}>
            <View style={[styles.detailsHeader, styles.rtlRow]}>
              <Text style={[styles.detailsTitle, styles.textRTL]}>
                {selectedDate.getDate()} {getMonthName(selectedDate.getMonth())}
              </Text>
              <TouchableOpacity 
                style={[styles.addButton, { backgroundColor: `${serviceColor}15` }]}
                onPress={() => handleAddAvailability(selectedDate)}
              >
                <Ionicons name="add" size={20} color={serviceColor} />
                <Text style={[styles.addButtonText, { color: serviceColor }, styles.textRTL]}>
                  הוסף זמינות
                </Text>
              </TouchableOpacity>
            </View>

            {/* Availabilities */}
            {dateAvailabilities.length > 0 ? (
              <View style={styles.availabilitiesList}>
                <Text style={[styles.sectionLabel, styles.textRTL]}>זמינויות</Text>
                {dateAvailabilities.map((av) => (
                  <View 
                    key={av.id} 
                    style={[
                      styles.availabilityCard,
                      { borderRightColor: serviceColor }
                    ]}
                  >
                    <View style={[styles.availabilityTimeRTL, styles.rtlRow]}>
                      <Ionicons name="time-outline" size={18} color="#6B7280" style={styles.iconRTL} />
                      <Text style={[styles.availabilityTimeText, styles.textRTL]}>
                        {av.startTime} - {av.endTime}
                      </Text>
                    </View>
                    {av.isRecurring && (
                      <View style={[styles.recurringBadge, { backgroundColor: `${serviceColor}15` }]}>
                        <Text style={[styles.recurringText, { color: serviceColor }, styles.textRTL]}>
                          חוזר
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity 
                      onPress={() => deleteAvailability(av.id)}
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noJobsContainer}>
                <Ionicons name="calendar-outline" size={40} color="#D1D5DB" />
                <Text style={[styles.noJobsText, styles.textRTL]}>
                  אין זמינות מוגדרת
                </Text>
                <Text style={[styles.noJobsSubtext, styles.textRTL]}>
                  לחץ על "הוסף זמינות" כדי להוסיף
                </Text>
              </View>
            )}

            {/* Jobs for this date */}
            {loading ? (
              <ActivityIndicator size="small" color={serviceColor} style={{ marginTop: 20 }} />
            ) : jobs.length > 0 ? (
              <View style={styles.jobsList}>
                <Text style={[styles.sectionLabel, styles.textRTL]}>משימות</Text>
                {jobs.map((job) => (
                  <View key={job.id} style={[styles.jobCard, styles.rtlRow]}>
                    <View style={styles.jobTime}>
                      <Text style={[styles.timeText, styles.textRTL]}>{job.time}</Text>
                      <View style={styles.durationContainer}>
                        <Text style={[styles.durationText, styles.textRTL]}>
                          {job.duration}ש'
                        </Text>
                      </View>
                    </View>
                    <View style={styles.jobInfoRTL}>
                      <Text style={[styles.clientName, styles.textRTL]}>{job.client}</Text>
                      <Text style={[styles.serviceName, styles.textRTL]}>{job.service}</Text>
                      <Text style={[styles.address, styles.textRTL]}>{job.address}</Text>
                    </View>
                    <View style={styles.jobActions}>
                      <View style={[
                        styles.statusBadge,
                        job.status === 'confirmed' ? styles.confirmedStatus : styles.pendingStatus
                      ]}>
                        <Text style={[styles.statusText, styles.textRTL]}>
                          {job.status === 'confirmed' ? 'מאושר' : 'ממתין'}
                        </Text>
                      </View>
                      <Text style={[styles.price, { color: serviceColor }, styles.textRTL]}>
                        ₪{job.price}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {/* Statistics */}
        {availabilities.length > 0 && (
          <View style={[styles.statsContainer, { borderColor: `${serviceColor}30` }]}>
            <Text style={[styles.statsText, { color: serviceColor }, styles.textRTL]}>
              {availabilities.filter(av => !av.isRecurring).length} זמינויות ספציפיות
            </Text>
            <Text style={[styles.statsSubtext, { color: serviceColor }, styles.textRTL]}>
              {availabilities.filter(av => av.isRecurring).length} זמינויות קבועות
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Add Button */}
      {!selectedDate && (
        <TouchableOpacity 
          style={[styles.floatingButtonRTL, { backgroundColor: serviceColor }]}
          onPress={() => {
            const today = new Date();
            setSelectedDate(today);
            setCurrentDate(today);
          }}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Add Availability Modal */}
      <Modal
        visible={showAvailabilityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvailabilityModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAvailabilityModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRTL}>
              <Text style={[styles.modalTitle, styles.textRTL]}>הוסף זמינות</Text>
              <TouchableOpacity onPress={() => setShowAvailabilityModal(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {modalDate && (
                <Text style={[styles.modalDateText, { color: serviceColor }, styles.textRTL]}>
                  {modalDate.getDate()} {getMonthName(modalDate.getMonth())} {modalDate.getFullYear()}
                </Text>
              )}

              <View style={styles.timeInputContainer}>
                <View style={styles.timeInput}>
                  <Text style={[styles.timeLabel, styles.textRTL]}>שעת התחלה</Text>
                  <TextInput
                    style={[styles.timeField, styles.textRTL]}
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="09:00"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                
                <Text style={styles.timeSeparator}>-</Text>
                
                <View style={styles.timeInput}>
                  <Text style={[styles.timeLabel, styles.textRTL]}>שעת סיום</Text>
                  <TextInput
                    style={[styles.timeField, styles.textRTL]}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="17:00"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={styles.recurringToggleRTL}
                onPress={() => setIsRecurring(!isRecurring)}
              >
                <View style={[
                  styles.checkbox,
                  isRecurring && { backgroundColor: serviceColor, borderColor: serviceColor }
                ]}>
                  {isRecurring && (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  )}
                </View>
                <Text style={[styles.timeLabel, styles.textRTL]}>זמינות קבועה (כל שבוע)</Text>
              </TouchableOpacity>

              <Text style={[styles.syncNote, { color: serviceColor }, styles.textRTL]}>
                ✅ הזמינויות יישמרו בענן ויסונכרנו בין המכשירים
              </Text>
            </View>

            <View style={styles.modalActionsRTL}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowAvailabilityModal(false)}
              >
                <Text style={[styles.cancelButtonText, styles.textRTL]}>ביטול</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.addButton, { backgroundColor: serviceColor }]}
                onPress={addAvailability}
              >
                <Text style={[styles.addButtonText, { color: '#FFFFFF' }, styles.textRTL]}>
                  הוסף
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
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
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    flex: 1,
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  calendarHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  monthButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  monthText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
  },
  weekdaysRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
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
    paddingHorizontal: 20,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 10,
    marginBottom: 8,
  },
  dayText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  disabledDay: {
    opacity: 0.3,
  },
  disabledDayText: {
    color: '#D1D5DB',
  },
  selectedDay: {
    backgroundColor: '#007AFF',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  jobDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detailsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailsHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
  },
  addButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  availabilitiesList: {
    marginBottom: 20,
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderRightWidth: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  availabilityTimeRTL: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  availabilityTimeText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#111827',
    marginRight: 8,
  },
  recurringBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 10,
  },
  recurringText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  deleteButton: {
    padding: 4,
  },
  jobsList: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  jobTime: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    minWidth: 56,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#111827',
  },
  durationContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: '#6B7280',
  },
  jobInfoRTL: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#111827',
    marginBottom: 2,
    textAlign: 'right',
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'right',
  },
  address: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: -0.1,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  jobActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 10,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  confirmedStatus: {
    backgroundColor: '#D1FAE5',
  },
  pendingStatus: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: '#111827',
  },
  price: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  noJobsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  noJobsText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  noJobsSubtext: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  statsContainer: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  statsSubtext: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: -0.1,
    textAlign: 'center',
    marginTop: 4,
  },
  floatingButtonRTL: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeaderRTL: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#111827',
  },
  modalBody: {
    marginBottom: 24,
  },
  modalDateText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 20,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timeInput: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    color: '#6B7280',
    marginBottom: 6,
  },
  timeField: {
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    textAlign: 'center',
    width: 80,
    backgroundColor: '#FFFFFF',
  },
  timeSeparator: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 16,
  },
  recurringToggleRTL: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncNote: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: -0.1,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalActionsRTL: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#6B7280',
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

export default CalendarScreen;