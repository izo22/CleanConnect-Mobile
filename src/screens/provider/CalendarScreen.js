// CalendarScreen.js - VERSION PRESTATAIRE SYNCHRONISÉE - CORRIGÉE - HOOKS FIXES
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

const getMonthName = (month) => {
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return monthNames[month];
};

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ✅ CORRECTION : CALENDRIER VIDE POUR NOUVEAUX PRESTATAIRES
const INITIAL_MOCK_AVAILABILITIES = []; // Tableau vide au lieu des données mock
const MOCK_JOBS = []; // Tableau vide au lieu des missions fictives

const CalendarScreen = ({ navigation, route }) => {
  // 🚨 TOUS LES HOOKS DOIVENT ÊTRE ICI AU DÉBUT - JAMAIS DANS DES CONDITIONS
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

  // 🔑 CLÉS DE STOCKAGE SPÉCIFIQUES AU PRESTATAIRE
  const getStorageKey = (type) => {
    return `${type}_${providerId}`;
  };

  // 🔄 CHARGER LES INFOS UTILISATEUR DEPUIS ASYNCSTORAGE
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

  // ✅ CORRECTION : CHARGER LES DISPONIBILITÉS SANS FORCER LES DONNÉES MOCK
  const loadAvailabilities = async () => {
    if (!providerId) return; // Ne rien faire si pas d'ID
    
    setIsLoadingAvailabilities(true);
    try {
      const storageKey = getStorageKey('provider_availabilities');
      
      const savedAvailabilities = await AsyncStorage.getItem(storageKey);
      
      if (savedAvailabilities) {
        const parsedAvailabilities = JSON.parse(savedAvailabilities);
        setAvailabilities(parsedAvailabilities);
      } else {
        // ✅ CORRECTION : Nouveau prestataire = calendrier vide (pas de sauvegarde automatique)
        setAvailabilities([]);
      }
    } catch (error) {
      setAvailabilities([]);
    } finally {
      setIsLoadingAvailabilities(false);
    }
  };

  // 🔄 CHARGER LES DISPONIBILITÉS QUAND L'ID EST DISPONIBLE
  useEffect(() => {
    if (providerId) {
      loadAvailabilities();
    }
  }, [providerId]);

  // 🔄 SAUVEGARDER LES DISPONIBILITÉS
  const saveAvailabilities = async (newAvailabilities) => {
    if (!providerId) return;
    
    try {
      const storageKey = getStorageKey('provider_availabilities');
      await AsyncStorage.setItem(storageKey, JSON.stringify(newAvailabilities));
    } catch (error) {
    }
  };

  // FONCTION OPTIMISÉE POUR VÉRIFIER LES JOBS
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

  // FONCTION OPTIMISÉE POUR VÉRIFIER LES DISPONIBILITÉS
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

  // Obtenir les disponibilités pour la date sélectionnée
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

  // Gérer l'ajout d'une disponibilité
  const handleAddAvailability = (date = null) => {
    const targetDate = date || selectedDate;
    if (!targetDate) return;
    setModalDate(targetDate);
    setShowAvailabilityModal(true);
  };

  // 🔄 AJOUTER UNE NOUVELLE DISPONIBILITÉ AVEC SAUVEGARDE
  const addAvailability = async () => {
    if (!modalDate || !startTime || !endTime) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (startTime >= endTime) {
      Alert.alert('Erreur', 'L\'heure de fin doit être après l\'heure de début');
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
    
    // 🔄 SAUVEGARDER ET METTRE À JOUR L'ÉTAT
    await saveAvailabilities(updatedAvailabilities);
    setAvailabilities(updatedAvailabilities);
    
    setShowAvailabilityModal(false);
    setStartTime('09:00');
    setEndTime('17:00');
    setIsRecurring(false);
    
    Alert.alert('Succès', 'Disponibilité ajoutée avec succès. Elle sera visible pour les clients.');
  };

  // 🔄 SUPPRIMER UNE DISPONIBILITÉ
  const deleteAvailability = async (availabilityId) => {
    Alert.alert(
      'Supprimer la disponibilité',
      'Êtes-vous sûr de vouloir supprimer cette disponibilité ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
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

  // Navigation mois
  const goToPreviousMonth = () => {
    const previousMonth = new Date(currentDate);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    setCurrentDate(previousMonth);
    setSelectedDate(null); // Reset la date sélectionnée
  };

  const goToNextMonth = () => {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentDate(nextMonth);
    setSelectedDate(null); // Reset la date sélectionnée
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

  // 🚨 RENDU CONDITIONNEL - PAS D'EARLY RETURN AVANT TOUS LES HOOKS
  // Chargement des données d'authentification
  if (isAuthLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement des données d'authentification...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Pas d'utilisateur ou rôle incorrect
  if (!providerId || userRole !== 'provider') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Erreur: Utilisateur non connecté ou rôle incorrect</Text>
          <Text style={styles.providerIdText}>Rôle: {userRole}, ID: {providerId}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 🔄 AFFICHAGE DE CHARGEMENT PENDANT LE CHARGEMENT DES DISPONIBILITÉS
  if (isLoadingAvailabilities) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement de vos disponibilités...</Text>
          <Text style={styles.providerIdText}>Prestataire ID: {providerId}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 🚨 RENDU PRINCIPAL - MAINTENANT TOUS LES HOOKS SONT DÉCLARÉS
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendrier - Mon Planning</Text>
        <Text style={styles.providerInfo}>Prestataire ID: {providerId}</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF4757' }]} />
            <Text style={styles.legendText}>Missions</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2ED573' }]} />
            <Text style={styles.legendText}>Disponible</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={goToPreviousMonth}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToCurrentMonth} style={styles.currentMonthButton}>
          <Text 
            style={styles.currentMonthText}
            key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
          >
            {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToNextMonth}>
          <Ionicons name="chevron-forward" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.weekdaysContainer}>
        {WEEKDAYS.map((day, index) => (
          <View key={index} style={styles.weekdayItem}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>
      
      {/* CALENDRIER AVEC INDICATEURS */}
      <ScrollView style={styles.calendarScrollView}>
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
                item.isToday && styles.todayContainer,
                isSelected && styles.selectedDayContainer,
              ]}
              disabled={!item.isCurrentMonth}
              onPress={() => item.date && setSelectedDate(item.date)}
            >
              <Text
                style={[
                  styles.dayText,
                  item.isToday && styles.todayText,
                  isSelected && styles.selectedDayText,
                ]}
              >
                {item.day}
              </Text>
              {/* INDICATEURS */}
              <View style={styles.indicatorsContainer}>
                {hasJobsForDay && <View style={[styles.indicator, styles.jobIndicator]} />}
                {hasAvailabilityForDay && <View style={[styles.indicator, styles.availabilityIndicator]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      </ScrollView>
      
      <View style={styles.selectedDateHeader}>
        <Text style={styles.selectedDateText}>
          {selectedDate ? 
            `${selectedDate.getDate()} ${getMonthName(selectedDate.getMonth())} ${selectedDate.getFullYear()}` : 
            'Sélectionnez une date'
          }
        </Text>
        {selectedDate && (
          <TouchableOpacity 
            style={styles.addAvailabilityButton}
            onPress={() => handleAddAvailability()}
          >
            <Ionicons name="add-circle" size={20} color="#007AFF" />
            <Text style={styles.addAvailabilityText}>Ajouter une disponibilité</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView style={styles.jobsContainer}>
          {/* MISSIONS */}
          {jobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Missions</Text>
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
                  
                  <View style={styles.jobInfo}>
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
                        {job.status === 'confirmed' ? 'Confirmé' : 'En attente'}
                      </Text>
                    </View>
                    <Text style={styles.price}>{job.price} ₪</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 🔄 SECTION DISPONIBILITÉS AVEC POSSIBILITÉ DE SUPPRIMER */}
          {selectedDateAvailabilities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Créneaux disponibles</Text>
              {selectedDateAvailabilities.map((availability) => (
                <View key={availability.id} style={styles.availabilityCard}>
                  <View style={styles.availabilityTime}>
                    <Ionicons name="time-outline" size={20} color="#2ED573" />
                    <Text style={styles.availabilityTimeText}>
                      {availability.startTime} - {availability.endTime}
                    </Text>
                  </View>
                  <View style={styles.availabilityInfo}>
                    {availability.isRecurring && (
                      <View style={styles.recurringBadge}>
                        <Text style={styles.recurringText}>Récurrent</Text>
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

          {/* MESSAGE QUAND AUCUNE DONNÉE */}
          {selectedDate && jobs.length === 0 && selectedDateAvailabilities.length === 0 && (
            <View style={styles.noJobsContainer}>
              <Ionicons name="calendar" size={60} color="#CCCCCC" />
              <Text style={styles.noJobsText}>Aucune activité prévue</Text>
              <Text style={styles.noJobsSubtext}>
                Cliquez sur "Ajouter une disponibilité" pour définir vos créneaux libres.
              </Text>
            </View>
          )}

          {/* MESSAGE QUAND AUCUNE DATE SÉLECTIONNÉE */}
          {!selectedDate && (
            <View style={styles.noJobsContainer}>
              <Ionicons name="calendar-outline" size={60} color="#CCCCCC" />
              <Text style={styles.noJobsText}>Sélectionnez une date</Text>
              <Text style={styles.noJobsSubtext}>
                Cliquez sur une date du calendrier pour voir vos missions et disponibilités.
              </Text>
              
              {/* 🔄 INFO SUR LE NOMBRE TOTAL DE DISPONIBILITÉS */}
              <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                  📊 Total de vos disponibilités : {availabilities.length}
                </Text>
                <Text style={styles.statsSubtext}>
                  {availabilities.length === 0 
                    ? "(Calendrier vide - Ajoutez vos premières disponibilités !)" 
                    : "(Visibles par tous les clients)"
                  }
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* BOUTON FLOTTANT CONDITIONNEL */}
      {selectedDate && (
        <TouchableOpacity 
          style={styles.floatingButton}
          onPress={() => handleAddAvailability()}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* MODAL D'AJOUT DE DISPONIBILITÉ */}
      <Modal
        visible={showAvailabilityModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAvailabilityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter une disponibilité</Text>
              <TouchableOpacity onPress={() => setShowAvailabilityModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalDateText}>
                {modalDate ? `${modalDate.getDate()} ${getMonthName(modalDate.getMonth())} ${modalDate.getFullYear()}` : ''}
              </Text>

              <View style={styles.timeInputContainer}>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>Début</Text>
                  <TextInput
                    style={styles.timeField}
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="09:00"
                  />
                </View>
                <Text style={styles.timeSeparator}>-</Text>
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>Fin</Text>
                  <TextInput
                    style={styles.timeField}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="17:00"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.recurringToggle}
                onPress={() => setIsRecurring(!isRecurring)}
              >
                <View style={[styles.checkbox, isRecurring && styles.checkboxChecked]}>
                  {isRecurring && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={styles.recurringText}>Répéter chaque semaine</Text>
              </TouchableOpacity>
              
              <Text style={styles.syncNote}>
                💡 Cette disponibilité sera automatiquement visible par tous les clients
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAvailabilityModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={addAvailability}
              >
                <Text style={styles.addButtonText}>Ajouter</Text>
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
  },
  providerIdText: {
    marginTop: 5,
    fontSize: 12,
    color: '#999999',
  },
  header: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  providerInfo: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 10,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666666',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  calendarScrollView: {
    maxHeight: 400, // Hauteur maximale pour le calendrier
    backgroundColor: '#FFFFFF',
  },
  currentMonthButton: {
    padding: 5,
  },
  currentMonthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
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
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
  },
  todayText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  selectedDayContainer: {
    backgroundColor: '#007AFF',
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
  availabilityIndicator: {
    backgroundColor: '#2ED573',
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
  },
  addAvailabilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 10,
  },
  addAvailabilityText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 5,
  },
  jobsContainer: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
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
  jobInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 2,
  },
  serviceName: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  address: {
    fontSize: 12,
    color: '#999999',
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
    color: '#007AFF',
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2ED573',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  availabilityTime: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availabilityTimeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginLeft: 8,
  },
  availabilityInfo: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
  },
  recurringBadge: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 10,
  },
  recurringText: {
    fontSize: 12,
    color: '#007AFF',
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
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2ED573',
  },
  statsText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statsSubtext: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 5,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
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
  modalHeader: {
    flexDirection: 'row',
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
    color: '#007AFF',
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
  recurringToggle: {
    flexDirection: 'row',
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
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  syncNote: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 15,
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: 'bold',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    marginLeft: 10,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default CalendarScreen;
