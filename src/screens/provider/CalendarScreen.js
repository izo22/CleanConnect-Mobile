// CalendarScreen.js - FIXED avec couleurs dynamiques selon serviceType
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
import { getServiceColor } from '../../config/constants';  // ✅ Import de la fonction helper (2 niveaux)

// Fonction utilitaire pour générer les dates du mois
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
  // ✅ RÉCUPÉRATION DU SERVICE TYPE ET DE SA COULEUR
  const serviceType = route.params?.serviceType || 'home';
  const serviceColor = getServiceColor(serviceType);
  
  // États d'authentification
  const [providerId, setProviderId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // États du calendrier
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingAvailabilities, setIsLoadingAvailabilities] = useState(true);
  
  // États pour le modal de disponibilité
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [modalDate, setModalDate] = useState(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [isRecurring, setIsRecurring] = useState(false);

  const getStorageKey = (type) => {
    return `${type}_${providerId}`;
  };

  // ✅ Noms des mois en hébreu
  const getMonthName = (month) => {
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return months[month];
  };

  // ✅ Jours de la semaine en hébreu
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
      } finally {
        setIsAuthLoading(false);
      }
    };
    
    loadUserInfo();
  }, []);

  const loadAvailabilities = async () => {
    if (!providerId) return;
    
    setIsLoadingAvailabilities(true);
    try {
      const storageKey = getStorageKey('provider_availabilities');
      const savedAvailabilities = await AsyncStorage.getItem(storageKey);
      
      if (savedAvailabilities) {
        const parsedAvailabilities = JSON.parse(savedAvailabilities);
        setAvailabilities(parsedAvailabilities);
      } else {
        setAvailabilities([]);
      }
    } catch (error) {
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

  const saveAvailabilities = async (newAvailabilities) => {
    if (!providerId) return;
    
    try {
      const storageKey = getStorageKey('provider_availabilities');
      await AsyncStorage.setItem(storageKey, JSON.stringify(newAvailabilities));
    } catch (error) {
    }
  };

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

    const updatedAvailabilities = [...availabilities, newAvailability];
    
    try {
      await saveAvailabilities(updatedAvailabilities);
      setAvailabilities(updatedAvailabilities);
      
      setShowAvailabilityModal(false);
      setStartTime('09:00');
      setEndTime('17:00');
      setIsRecurring(false);
      
      Alert.alert('הצלחה', 'הזמינות נוספה בהצלחה');
    } catch (error) {
      Alert.alert('שגיאה', 'שגיאה בשמירת הזמינות: ' + error.message);
    }
  };

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
            const updatedAvailabilities = availabilities.filter(av => av.id !== availabilityId);
            await saveAvailabilities(updatedAvailabilities);
            setAvailabilities(updatedAvailabilities);
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

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const selectedDateAvailabilities = selectedDate ? getAvailabilitiesForDate(selectedDate) : [];

  if (isAuthLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={serviceColor} />
          <Text style={styles.loadingText}>טוען אימות...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!providerId || userRole !== 'provider') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>לא מחובר כנותן שירות</Text>
          <Text style={styles.providerIdText}>
            תפקיד: {userRole}, ID: {providerId}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoadingAvailabilities) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={serviceColor} />
          <Text style={styles.loadingText}>טוען זמינויות...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ✅ HEADER avec couleur dynamique */}
      <View style={[styles.header, { backgroundColor: serviceColor }]}>
        <Text style={styles.headerTitle}>בחר משבצת זמן</Text>
        <View style={styles.legendRTL}>
          <View style={styles.legendItemRTL}>
            <View style={[styles.legendDot, { backgroundColor: '#FF4757' }]} />
            <Text style={styles.legendTextWhite}>משימות</Text>
          </View>
          <View style={styles.legendItemRTL}>
            <View style={[styles.legendDot, { backgroundColor: serviceColor }]} />
            <Text style={styles.legendTextWhite}>זמין</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.calendarHeaderRTL}>
        <TouchableOpacity onPress={goToNextMonth}>
          <Ionicons name="chevron-forward" size={24} color={serviceColor} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToCurrentMonth} style={styles.currentMonthButton}>
          <Text 
            style={[styles.currentMonthText, { color: serviceColor }]}
            key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
          >
            {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToPreviousMonth}>
          <Ionicons name="chevron-back" size={24} color={serviceColor} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.weekdaysContainer}>
        {WEEKDAYS.map((day, index) => (
          <View key={index} style={styles.weekdayItem}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>
      
      <ScrollView style={styles.mainScrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.calendarContainer}>
          {calendarDays.map((item, index) => {
            const hasJobsForDay = hasJobs(item.date);
            const hasAvailabilityForDay = hasAvailability(item.date);
            const isSelected = selectedDate && 
              item.date && 
              selectedDate.getDate() === item.date.getDate() && 
              selectedDate.getMonth() === item.date.getMonth() && 
              selectedDate.getFullYear() === item.date.getFullYear();
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayContainer,
                  !item.isCurrentMonth && styles.disabledDay,
                  item.isToday && [styles.todayContainer, { backgroundColor: `${serviceColor}20` }],
                  isSelected && [styles.selectedDayContainer, { backgroundColor: serviceColor }],
                ]}
                disabled={!item.isCurrentMonth}
                onPress={() => item.date && setSelectedDate(item.date)}
              >
                <Text
                  style={[
                    styles.dayText,
                    item.isToday && [styles.todayText, { color: serviceColor }],
                    isSelected && styles.selectedDayText,
                  ]}
                >
                  {item.day}
                </Text>
                <View style={styles.indicatorsContainer}>
                  {hasJobsForDay && <View style={[styles.indicator, styles.jobIndicator]} />}
                  {hasAvailabilityForDay && <View style={[styles.indicator, { backgroundColor: serviceColor }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        
        <View style={styles.selectedDateHeader}>
          <Text style={styles.selectedDateText}>
            {selectedDate ? 
              `${selectedDate.getDate()} ${getMonthName(selectedDate.getMonth())} ${selectedDate.getFullYear()}` : 
              'בחר תאריך בלוח השנה'
            }
          </Text>
          {selectedDate && (
            <TouchableOpacity 
              style={[styles.addAvailabilityButton, { backgroundColor: `${serviceColor}20` }]}
              onPress={() => handleAddAvailability()}
            >
              <Ionicons name="add-circle" size={20} color={serviceColor} />
              <Text style={[styles.addAvailabilityText, { color: serviceColor }]}>הוסף זמינות</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={serviceColor} />
          </View>
        ) : (
          <View style={styles.jobsContainer}>
          {jobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>משימות</Text>
              {jobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
                >
                  <View style={styles.jobTime}>
                    <Text style={styles.timeText}>{formatTime(job.date)}</Text>
                    <View style={styles.durationContainer}>
                      <Text style={styles.durationText}>{job.duration}h</Text>
                    </View>
                  </View>
                  
                  <View style={styles.jobInfoRTL}>
                    <Text style={styles.clientName}>{job.clientName}</Text>
                    <Text style={styles.serviceName}>{job.serviceName}</Text>
                    <Text style={styles.address}>{job.address}</Text>
                  </View>
                  
                  <View style={styles.jobActions}>
                    <View
                      style={[
                        styles.statusBadge,
                        job.status === 'confirmed' ? styles.confirmedStatus : styles.pendingStatus,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {job.status === 'confirmed' ? 'מאושר' : 'ממתין'}
                      </Text>
                    </View>
                    <Text style={[styles.price, { color: serviceColor }]}>{job.price} ₪</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedDateAvailabilities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>זמנים פנויים</Text>
              {selectedDateAvailabilities.map((availability) => (
                <View key={availability.id} style={[styles.availabilityCard, { borderRightColor: serviceColor }]}>
                  <View style={styles.availabilityTimeRTL}>
                    <Ionicons name="time-outline" size={20} color={serviceColor} />
                    <Text style={styles.availabilityTimeText}>
                      {availability.startTime} - {availability.endTime}
                    </Text>
                  </View>
                  <View style={styles.availabilityInfoRTL}>
                    {availability.isRecurring && (
                      <View style={[styles.recurringBadge, { backgroundColor: `${serviceColor}20` }]}>
                        <Text style={[styles.recurringText, { color: serviceColor }]}>חוזר</Text>
                      </View>
                    )}
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => deleteAvailability(availability.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF4757" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {selectedDate && jobs.length === 0 && selectedDateAvailabilities.length === 0 && (
            <View style={styles.noJobsContainer}>
              <Ionicons name="calendar" size={60} color="#CCCCCC" />
              <Text style={styles.noJobsText}>אין משימות או זמינויות ליום זה</Text>
              <Text style={styles.noJobsSubtext}>
                לחץ על כפתור + כדי להוסיף זמינות
              </Text>
            </View>
          )}

          {!selectedDate && (
            <View style={styles.noJobsContainer}>
              <Ionicons name="calendar-outline" size={60} color="#CCCCCC" />
              <Text style={styles.noJobsText}>בחר תאריך כדי לראות משימות וזמינויות</Text>
              <Text style={styles.noJobsSubtext}>
                לחץ על יום בלוח השנה למעלה
              </Text>
              
              <View style={[styles.statsContainer, { backgroundColor: `${serviceColor}10`, borderColor: serviceColor }]}>
                <Text style={[styles.statsText, { color: serviceColor }]}>
                  סה"כ {availabilities.length} זמינויות מוגדרות
                </Text>
                <Text style={[styles.statsSubtext, { color: serviceColor }]}>
                  {availabilities.length === 0 
                    ? 'הוסף זמינות כדי לאפשר ללקוחות להזמין'
                    : 'ניתן לראות אותן בלוח השנה (נקודות צבעוניות)'
                  }
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
      </ScrollView>

      {selectedDate && (
        <TouchableOpacity 
          style={[styles.floatingButtonRTL, { backgroundColor: serviceColor }]}
          onPress={() => handleAddAvailability()}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <Modal
        visible={showAvailabilityModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAvailabilityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRTL}>
              <Text style={styles.modalTitle}>הוסף זמינות</Text>
              <TouchableOpacity onPress={() => setShowAvailabilityModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalDateText, { color: serviceColor }]}>
                {modalDate ? `${modalDate.getDate()} ${getMonthName(modalDate.getMonth())} ${modalDate.getFullYear()}` : ''}
              </Text>

              <View style={styles.timeInputContainer}>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>התחלה</Text>
                  <TextInput
                    style={styles.timeField}
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="09:00"
                  />
                </View>
                <Text style={styles.timeSeparator}>-</Text>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>סיום</Text>
                  <TextInput
                    style={styles.timeField}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="17:00"
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
                  {isRecurring && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={styles.recurringText}>חזור כל שבוע באותו יום</Text>
              </TouchableOpacity>
              
              <Text style={[styles.syncNote, { color: serviceColor }]}>השינויים נשמרים באופן מקומי</Text>
            </View>

            <View style={styles.modalActionsRTL}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAvailabilityModal(false)}
              >
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: serviceColor }]}
                onPress={addAvailability}
              >
                <Text style={styles.addButtonText}>הוסף</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
    textAlign: 'right',
  },
  providerIdText: {
    marginTop: 5,
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
    textAlign: 'right',
  },
  legendRTL: {
    flexDirection: 'row-reverse',
  },
  legendItemRTL: {
    flexDirection: 'row-reverse',
    marginRight: 0,
    marginLeft: 20,
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666666',
  },
  legendTextWhite: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  calendarHeaderRTL: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  mainScrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  currentMonthButton: {
    padding: 5,
  },
  currentMonthText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  weekdaysContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  weekdayItem: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  calendarContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    paddingBottom: 10,
  },
  dayContainer: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
    position: 'relative',
  },
  dayText: {
    fontSize: 16,
    color: '#333333',
  },
  disabledDay: {
    opacity: 0.3,
  },
  todayContainer: {
    borderRadius: 20,
  },
  todayText: {
    fontWeight: 'bold',
  },
  selectedDayContainer: {
    borderRadius: 20,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  indicatorsContainer: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 1,
    elevation: 3,
  },
  jobIndicator: {
    backgroundColor: '#FF4757',
  },
  selectedDateHeader: {
    padding: 15,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    alignItems: 'center',
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
  },
  addAvailabilityButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 10,
  },
  addAvailabilityText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 5,
  },
  jobsContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
    textAlign: 'right',
  },
  jobCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  jobTime: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    minWidth: 60,
  },
  timeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  durationContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: 15,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 5,
  },
  durationText: {
    fontSize: 12,
    color: '#666666',
  },
  jobInfoRTL: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 2,
    textAlign: 'right',
  },
  serviceName: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    textAlign: 'right',
  },
  address: {
    fontSize: 12,
    color: '#999999',
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
    borderRadius: 12,
    marginBottom: 10,
  },
  confirmedStatus: {
    backgroundColor: '#E8F5E9',
  },
  pendingStatus: {
    backgroundColor: '#FFF8E1',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderRightWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  availabilityTimeRTL: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  availabilityTimeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginRight: 8,
  },
  availabilityInfoRTL: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  recurringBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 10,
  },
  recurringText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 5,
  },
  noJobsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  noJobsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666666',
    marginTop: 20,
    textAlign: 'center',
  },
  noJobsSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
  statsContainer: {
    marginTop: 30,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
  },
  statsText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statsSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
  floatingButtonRTL: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalBody: {
    marginBottom: 30,
  },
  modalDateText: {
    fontSize: 16,
    fontWeight: 'bold',
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
    fontSize: 14,
    color: '#666666',
    marginBottom: 5,
  },
  timeField: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    textAlign: 'center',
    width: 80,
  },
  timeSeparator: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginHorizontal: 20,
  },
  recurringToggleRTL: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#DDDDDD',
    borderRadius: 4,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncNote: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalActionsRTL: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 15,
    borderRadius: 10,
    marginLeft: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: 'bold',
  },
  addButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default CalendarScreen;