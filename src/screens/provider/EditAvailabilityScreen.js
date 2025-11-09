import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch
} from 'react-native';
import { Card, Button, IconButton, Divider, ActivityIndicator } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { providerService } from '../../services/api';


const EditAvailabilityScreen = ({ route }) => {
  const navigation = useNavigation();
  const { availability } = route.params || { availability: [] };
  const [loading, setLoading] = useState(false);

  // Convertir les entrées de disponibilité en format lisible pour l'interface utilisateur
  const initialAvailability = [];
  
  // Liste des jours de la semaine
  const days = [
    { id: 0, name: 'Dimanche', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 1, name: 'Lundi', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 2, name: 'Mardi', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 3, name: 'Mercredi', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 4, name: 'Jeudi', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 5, name: 'Vendredi', enabled: false, startTime: '09:00', endTime: '17:00' },
    { id: 6, name: 'Samedi', enabled: false, startTime: '09:00', endTime: '17:00' },
  ];

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
        'Erreur de validation',
        'L\'heure de fin doit être postérieure à l\'heure de début pour tous les jours actifs.'
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
      Alert.alert('Succès', 'Vos disponibilités ont été mises à jour avec succès');
      navigation.goBack();
    } catch (error) {
      console.error('Erreur lors de la mise à jour des disponibilités:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la mise à jour de vos disponibilités'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Card style={styles.card}>
          <Card.Title title="Définir vos disponibilités" />
          <Card.Content>
            <Text style={styles.description}>
              Activez les jours où vous êtes disponible et définissez vos heures de travail pour chaque jour.
            </Text>

            {availabilityData.map((day, index) => (
              <View key={index}>
                <View style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <Switch
                      value={day.enabled}
                      onValueChange={() => handleDayToggle(index)}
                    />
                    <Text style={[
                      styles.dayName,
                      !day.enabled && styles.dayDisabled
                    ]}>
                      {day.name}
                    </Text>
                  </View>
                  
                  <View style={styles.timeContainer}>
                    <TouchableOpacity
                      style={[styles.timeButton, !day.enabled && styles.timeButtonDisabled]}
                      onPress={() => day.enabled && showStartPicker(index)}
                      disabled={!day.enabled}
                    >
                      <Text style={[styles.timeText, !day.enabled && styles.timeTextDisabled]}>
                        {day.startTime}
                      </Text>
                    </TouchableOpacity>
                    
                    <Text style={[styles.timeSeparator, !day.enabled && styles.dayDisabled]}>-</Text>
                    
                    <TouchableOpacity
                      style={[styles.timeButton, !day.enabled && styles.timeButtonDisabled]}
                      onPress={() => day.enabled && showEndPicker(index)}
                      disabled={!day.enabled}
                    >
                      <Text style={[styles.timeText, !day.enabled && styles.timeTextDisabled]}>
                        {day.endTime}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {index < availabilityData.length - 1 && <Divider style={styles.divider} />}
              </View>
            ))}
          </Card.Content>

          <Card.Actions style={styles.cardActions}>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={loading}
              disabled={loading}
              style={styles.saveButton}
            >
              Enregistrer
            </Button>
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              Annuler
            </Button>
          </Card.Actions>
        </Card>
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
          <ActivityIndicator size="large" color="#0066CC" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  description: {
    marginBottom: 20,
    color: '#666',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayName: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  dayDisabled: {
    color: '#999',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButton: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  timeButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  timeText: {
    color: '#0277BD',
    fontWeight: '500',
  },
  timeTextDisabled: {
    color: '#999',
  },
  timeSeparator: {
    marginHorizontal: 8,
    fontWeight: 'bold',
  },
  divider: {
    backgroundColor: '#eee',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  saveButton: {
    marginRight: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

export default EditAvailabilityScreen;