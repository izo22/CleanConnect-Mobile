import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DAYS_OF_WEEK = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

const TIME_SLOTS = [
  { id: 'morning', label: 'Matin', time: '8:00 - 12:00' },
  { id: 'afternoon', label: 'Après-midi', time: '12:00 - 16:00' },
  { id: 'evening', label: 'Soir', time: '16:00 - 20:00' },
];

const AvailabilityScreen = ({ navigation }) => {
  // État pour stocker les disponibilités
  const [availabilities, setAvailabilities] = useState({});
  const [loading, setLoading] = useState(true);
  const [applyToAll, setApplyToAll] = useState(false);

  // Charger les disponibilités existantes
  useEffect(() => {
    loadAvailabilities();
  }, []);

  const loadAvailabilities = async () => {
    setLoading(true);
    
    // Ici, vous feriez un appel API pour récupérer les disponibilités
    // Simulons des données pour l'exemple
    const mockAvailabilities = {};
    
    // Initialiser toutes les disponibilités à false par défaut
    DAYS_OF_WEEK.forEach(day => {
      mockAvailabilities[day] = {};
      TIME_SLOTS.forEach(slot => {
        mockAvailabilities[day][slot.id] = false;
      });
    });
    
    // Ajouter quelques disponibilités de test
    mockAvailabilities['Lundi']['morning'] = true;
    mockAvailabilities['Lundi']['afternoon'] = true;
    mockAvailabilities['Mercredi']['morning'] = true;
    mockAvailabilities['Jeudi']['afternoon'] = true;
    mockAvailabilities['Jeudi']['evening'] = true;
    mockAvailabilities['Vendredi']['morning'] = true;
    
    setAvailabilities(mockAvailabilities);
    setLoading(false);
  };

  // Fonction pour basculer la disponibilité d'un créneau horaire
  const toggleAvailability = (day, slotId) => {
    const newAvailabilities = { ...availabilities };
    
    if (applyToAll) {
      // Appliquer le même changement à tous les jours
      const newValue = !newAvailabilities[day][slotId];
      DAYS_OF_WEEK.forEach(d => {
        newAvailabilities[d][slotId] = newValue;
      });
    } else {
      // Appliquer le changement seulement au jour sélectionné
      newAvailabilities[day][slotId] = !newAvailabilities[day][slotId];
    }
    
    setAvailabilities(newAvailabilities);
  };

  // Fonction pour définir un jour entier comme disponible ou non
  const toggleFullDay = (day, value) => {
    const newAvailabilities = { ...availabilities };
    
    if (applyToAll) {
      // Appliquer à tous les jours
      DAYS_OF_WEEK.forEach(d => {
        TIME_SLOTS.forEach(slot => {
          newAvailabilities[d][slot.id] = value;
        });
      });
    } else {
      // Appliquer seulement au jour sélectionné
      TIME_SLOTS.forEach(slot => {
        newAvailabilities[day][slot.id] = value;
      });
    }
    
    setAvailabilities(newAvailabilities);
  };

  // Fonction pour enregistrer les disponibilités
  const saveAvailabilities = async () => {
    // Ici, vous feriez un appel API pour sauvegarder les disponibilités
    // Pour l'exemple, on simule une sauvegarde réussie
    
    Alert.alert(
      "Disponibilités enregistrées",
      "Vos disponibilités ont été mises à jour avec succès.",
      [{ text: "OK" }]
    );
  };

  // Vérifier si tous les créneaux d'un jour sont disponibles
  const isDayFullyAvailable = (day) => {
    return TIME_SLOTS.every(slot => availabilities[day][slot.id]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gérer vos disponibilités</Text>
      </View>
      
      <View style={styles.applyToAllContainer}>
        <Text style={styles.applyToAllText}>
          Appliquer les changements à tous les jours
        </Text>
        <Switch
          value={applyToAll}
          onValueChange={setApplyToAll}
          trackColor={{ false: "#D1D1D6", true: "#4CD964" }}
        />
      </View>
      
      <ScrollView style={styles.scrollView}>
        {DAYS_OF_WEEK.map((day) => (
          <View key={day} style={styles.dayContainer}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{day}</Text>
              <View style={styles.dayActions}>
                <TouchableOpacity
                  style={styles.allDayButton}
                  onPress={() => toggleFullDay(day, true)}
                >
                  <Text style={styles.allDayButtonText}>Tout</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.allDayButton, styles.noneDayButton]}
                  onPress={() => toggleFullDay(day, false)}
                >
                  <Text style={styles.noneDayButtonText}>Aucun</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.timeSlots}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.timeSlot,
                    availabilities[day]?.[slot.id] ? styles.availableSlot : styles.unavailableSlot
                  ]}
                  onPress={() => toggleAvailability(day, slot.id)}
                >
                  <View style={styles.slotInfo}>
                    <Text style={styles.slotLabel}>{slot.label}</Text>
                    <Text style={styles.slotTime}>{slot.time}</Text>
                  </View>
                  <View style={styles.slotStatus}>
                    {availabilities[day]?.[slot.id] ? (
                      <Ionicons name="checkmark-circle" size={24} color="#4CD964" />
                    ) : (
                      <Ionicons name="close-circle" size={24} color="#FF3B30" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveAvailabilities}
        >
          <Text style={styles.saveButtonText}>Enregistrer les disponibilités</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
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
  },
  applyToAllContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  applyToAllText: {
    fontSize: 16,
    color: '#333333',
  },
  scrollView: {
    flex: 1,
  },
  dayContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  dayActions: {
    flexDirection: 'row',
  },
  allDayButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 15,
    marginLeft: 10,
  },
  allDayButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  noneDayButton: {
    backgroundColor: '#FFEBEE',
  },
  noneDayButtonText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  timeSlots: {
    padding: 10,
  },
  timeSlot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginVertical: 5,
  },
  availableSlot: {
    backgroundColor: '#F0FFF0',
    borderWidth: 1,
    borderColor: '#CCFFCC',
  },
  unavailableSlot: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  slotInfo: {
    flex: 1,
  },
  slotLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  slotTime: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  slotStatus: {
    marginLeft: 10,
  },
  footer: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AvailabilityScreen;
