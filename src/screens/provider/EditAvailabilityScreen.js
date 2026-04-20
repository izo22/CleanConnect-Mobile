// EditAvailabilityScreen.js - REFONTE UI MINIMALISTE PREMIUM + TRADUCTION HÉBRAÏQUE
/*
CHANGEMENTS MAJEURS APPLIQUÉS:
✓ Typographie: fontSize réduits de 10-15% (title 17px, description 13px, dayName 14px)
✓ Poids: '400' par défaut, '600' uniquement pour titres/CTA/prix
✓ Container: fond #F9FAFB (gris ultra-clair)
✓ Card: borderRadius 12px, bordures 1px #F3F4F6, ombres supprimées
✓ Time buttons: backgroundColor à 10% d'opacité (#3B82F610), borderRadius 6px
✓ Switch: couleur moderne (#10B981 pour actif)
✓ Separators: bordures ultra-subtiles #F3F4F6
✓ Buttons: hauteur 40px, style outline pour cancel, filled pour save
✓ Colors: #111827 (textes actifs), #6B7280 (secondaires), #9CA3AF (disabled)
✓ Spacing: doublé entre sections (24px)
✓ letterSpacing: -0.2 à -0.3 pour compression visuelle
✓ lineHeight: serré (1.3-1.4)
✓ TRADUCTION: Tous les textes traduits en hébreu (RTL natif)
*/
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch,
  ActivityIndicator
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { providerService } from '../../services/api';

const EditAvailabilityScreen = ({ route }) => {
  const navigation = useNavigation();
  const { availability } = route.params || { availability: [] };
  const [loading, setLoading] = useState(false);

  // Liste des jours de la semaine en hébreu
  const getDays = () => [
    { id: 0, name: 'יום ראשון', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 1, name: 'יום שני', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 2, name: 'יום שלישי', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 3, name: 'יום רביעי', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 4, name: 'יום חמישי', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 5, name: 'יום שישי', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 6, name: 'יום שבת', enabled: false, startTime: '09:00', endTime: '17:00' },
  ];

  const days = getDays();
  const initialAvailability = [];
  
  // Initialiser les jours avec les données existantes
  if (availability && availability.length > 0) {
    availability.forEach(slot => {
      const dayIndex = initialAvailability.findIndex(d => d.id === slot.day);
      if (dayIndex >= 0) {
        initialAvailability[dayIndex].enabled = true;
        initialAvailability[dayIndex].startTime = slot.startTime;
        initialAvailability[dayIndex].endTime = slot.endTime;
      } else {
        const day = days.find(d => d.id === slot.day);
        if (day) {
          initialAvailability.push({
            ...day,
            enabled: true,
            startTime: slot.startTime,
            endTime: slot.endTime
          });
        }
      }
    });
  }

  // Ajouter les jours manquants
  days.forEach(day => {
    if (!initialAvailability.some(d => d.id === day.id)) {
      initialAvailability.push(day);
    }
  });

  // Trier par jour de la semaine
  initialAvailability.sort((a, b) => a.id - b.id);

  const [availabilityData, setAvailabilityData] = useState(initialAvailability.length > 0 ? initialAvailability : days);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);

  // Convertir une chaîne de temps en objet Date
  const timeStringToDate = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Convertir un objet Date en chaîne de temps HH:MM
  const dateToTimeString = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Gérer le changement de l'heure de début
  const handleStartTimeChange = (event, selectedDate) => {
    setShowStartTimePicker(false);
    if (selectedDate && selectedDayIndex !== null) {
      const timeString = dateToTimeString(selectedDate);
      const updatedAvailability = [...availabilityData];
      updatedAvailability[selectedDayIndex].startTime = timeString;
      setAvailabilityData(updatedAvailability);
    }
  };

  // Gérer le changement de l'heure de fin
  const handleEndTimeChange = (event, selectedDate) => {
    setShowEndTimePicker(false);
    if (selectedDate && selectedDayIndex !== null) {
      const timeString = dateToTimeString(selectedDate);
      const updatedAvailability = [...availabilityData];
      updatedAvailability[selectedDayIndex].endTime = timeString;
      setAvailabilityData(updatedAvailability);
    }
  };

  // Afficher le sélecteur d'heure de début
  const showStartPicker = (index) => {
    setSelectedDayIndex(index);
    setShowStartTimePicker(true);
  };

  // Afficher le sélecteur d'heure de fin
  const showEndPicker = (index) => {
    setSelectedDayIndex(index);
    setShowEndTimePicker(true);
  };

  // Gérer l'activation/désactivation d'un jour
  const handleDayToggle = (index) => {
    const updatedAvailability = [...availabilityData];
    updatedAvailability[index].enabled = !updatedAvailability[index].enabled;
    setAvailabilityData(updatedAvailability);
  };

  // Enregistrer les disponibilités
  const handleSave = async () => {
    // Valider les données
    const invalidDays = availabilityData.filter(day => {
      if (!day.enabled) return false;
      
      const start = timeStringToDate(day.startTime);
      const end = timeStringToDate(day.endTime);
      return start >= end;
    });

    if (invalidDays.length > 0) {
      Alert.alert(
        'שגיאת אימות',
        'שעת הסיום חייבת להיות אחרי שעת ההתחלה בכל הימים המסומנים.'
      );
      return;
    }

    // Formater les données pour l'API
    const formattedAvailability = availabilityData
      .filter(day => day.enabled)
      .map(day => ({
        day: day.id,
        startTime: day.startTime,
        endTime: day.endTime
      }));

    setLoading(true);

    try {
      await providerService.updateAvailability({ availability: formattedAvailability });
      Alert.alert(
        'הצלחה',
        'הזמינות שלך עודכנה בהצלחה.'
      );
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'שגיאה בעדכון',
        'אירעה שגיאה בעדכון הזמינות שלך. אנא נסה שוב.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.title}>עריכת זמינות</Text>
          </View>
          
          {/* Content */}
          <View style={styles.cardContent}>
            <Text style={styles.description}>
              בחר את הימים והשעות בהם אתה זמין לספק שירותים. לקוחות יוכלו לקבוע פגישה רק בזמנים אלו.
            </Text>

            {availabilityData.map((day, index) => (
              <View key={index}>
                <View style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <Switch
                      value={day.enabled}
                      onValueChange={() => handleDayToggle(index)}
                      trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor="#E5E7EB"
                    />
                    <Text style={[
                      styles.dayName,
                      !day.enabled && styles.dayDisabled
                    ]}>
                      {day.name}
                    </Text>
                  </View>

                  {day.enabled && (
                    <View style={styles.timeContainer}>
                      <TouchableOpacity
                        onPress={() => showStartPicker(index)}
                        style={styles.timeButton}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeText}>{day.startTime}</Text>
                      </TouchableOpacity>
                      
                      <Text style={styles.timeSeparator}>-</Text>
                      
                      <TouchableOpacity
                        onPress={() => showEndPicker(index)}
                        style={styles.timeButton}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeText}>{day.endTime}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                
                {/* Séparateur visuel subtil */}
                {index < availabilityData.length - 1 && (
                  <View style={styles.separator} />
                )}
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              style={[styles.saveButton, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>שמור</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={loading}
              style={[styles.cancelButton, loading && styles.buttonDisabled]}
            >
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showStartTimePicker && (
        <DateTimePicker
          value={timeStringToDate(availabilityData[selectedDayIndex].startTime)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleStartTimeChange}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={timeStringToDate(availabilityData[selectedDayIndex].endTime)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleEndTimeChange}
        />
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  cardHeader: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cardContent: {
    padding: 20,
  },
  description: {
    marginBottom: 24,
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  dayRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  dayHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  dayDisabled: {
    color: '#9CA3AF',
  },
  timeContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  timeButton: {
    backgroundColor: '#3B82F610',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  timeText: {
    color: '#3B82F6',
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: -0.2,
  },
  timeSeparator: {
    color: '#9CA3AF',
    fontWeight: '400',
    fontSize: 14,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 0,
  },
  cardActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

export default EditAvailabilityScreen;