import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch, Alert, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const AvailabilityScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  const DAYS_OF_WEEK = [
    { key: 'sunday', label: t('availability.daysOfWeek.sunday') },
    { key: 'monday', label: t('availability.daysOfWeek.monday') },
    { key: 'tuesday', label: t('availability.daysOfWeek.tuesday') },
    { key: 'wednesday', label: t('availability.daysOfWeek.wednesday') },
    { key: 'thursday', label: t('availability.daysOfWeek.thursday') },
    { key: 'friday', label: t('availability.daysOfWeek.friday') },
    { key: 'saturday', label: t('availability.daysOfWeek.saturday') },
  ];

  const TIME_SLOTS = [
    { id: 'morning', label: t('availability.timeSlots.morning'), time: t('availability.timeSlots.morningTime') },
    { id: 'afternoon', label: t('availability.timeSlots.afternoon'), time: t('availability.timeSlots.afternoonTime') },
    { id: 'evening', label: t('availability.timeSlots.evening'), time: t('availability.timeSlots.eveningTime') },
  ];

  const [availabilities, setAvailabilities] = useState({});
  const [loading, setLoading] = useState(true);
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    loadAvailabilities();
  }, []);

  const loadAvailabilities = async () => {
    setLoading(true);
    const mockAvailabilities = {};
    
    DAYS_OF_WEEK.forEach(day => {
      mockAvailabilities[day.key] = {};
      TIME_SLOTS.forEach(slot => {
        mockAvailabilities[day.key][slot.id] = false;
      });
    });
    
    mockAvailabilities['monday']['morning'] = true;
    mockAvailabilities['monday']['afternoon'] = true;
    mockAvailabilities['wednesday']['morning'] = true;
    
    setAvailabilities(mockAvailabilities);
    setLoading(false);
  };

  const toggleAvailability = (dayKey, slotId) => {
    const newAvailabilities = { ...availabilities };
    
    if (applyToAll) {
      const newValue = !newAvailabilities[dayKey][slotId];
      DAYS_OF_WEEK.forEach(d => {
        newAvailabilities[d.key][slotId] = newValue;
      });
    } else {
      newAvailabilities[dayKey][slotId] = !newAvailabilities[dayKey][slotId];
    }
    
    setAvailabilities(newAvailabilities);
  };

  const toggleFullDay = (dayKey, value) => {
    const newAvailabilities = { ...availabilities };
    
    if (applyToAll) {
      DAYS_OF_WEEK.forEach(d => {
        TIME_SLOTS.forEach(slot => {
          newAvailabilities[d.key][slot.id] = value;
        });
      });
    } else {
      TIME_SLOTS.forEach(slot => {
        newAvailabilities[dayKey][slot.id] = value;
      });
    }
    
    setAvailabilities(newAvailabilities);
  };

  const saveAvailabilities = async () => {
    Alert.alert(
      t('availability.saveSuccess'),
      t('availability.saveMessage'),
      [{ text: t('availability.ok') }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>{t('availability.title')}</Text>
      </View>
      
      <View style={[styles.applyToAllContainer, isRTL && styles.rowRTL]}>
        <Text style={[styles.applyToAllText, isRTL && styles.textRTL]}>
          {t('availability.applyToAll')}
        </Text>
        <Switch value={applyToAll} onValueChange={setApplyToAll} trackColor={{ false: "#D1D1D6", true: "#4CD964" }} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        {DAYS_OF_WEEK.map((day) => (
          <View key={day.key} style={styles.dayContainer}>
            <View style={[styles.dayHeader, isRTL && styles.rowRTL]}>
              <Text style={[styles.dayTitle, isRTL && styles.textRTL]}>{day.label}</Text>
              <View style={[styles.dayActions, isRTL && styles.rowRTL]}>
                <TouchableOpacity style={styles.allDayButton} onPress={() => toggleFullDay(day.key, true)}>
                  <Text style={[styles.allDayButtonText, isRTL && styles.textRTL]}>{t('availability.selectAll')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.allDayButton, styles.noneDayButton]} onPress={() => toggleFullDay(day.key, false)}>
                  <Text style={[styles.noneDayButtonText, isRTL && styles.textRTL]}>{t('availability.unselectAll')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.timeSlots}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.timeSlot,
                    availabilities[day.key]?.[slot.id] ? styles.availableSlot : styles.unavailableSlot,
                    isRTL && styles.rowRTL
                  ]}
                  onPress={() => toggleAvailability(day.key, slot.id)}
                >
                  <View style={styles.slotInfo}>
                    <Text style={[styles.slotLabel, isRTL && styles.textRTL]}>{slot.label}</Text>
                    <Text style={[styles.slotTime, isRTL && styles.textRTL]}>{slot.time}</Text>
                  </View>
                  <View style={styles.slotStatus}>
                    {availabilities[day.key]?.[slot.id] ? (
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
        <TouchableOpacity style={styles.saveButton} onPress={saveAvailabilities}>
          <Text style={[styles.saveButtonText, isRTL && styles.textRTL]}>{t('availability.title')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: { padding: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333333' },
  applyToAllContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#FFFFFF', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  applyToAllText: { fontSize: 16, color: '#333333' },
  scrollView: { flex: 1 },
  dayContainer: { backgroundColor: '#FFFFFF', marginHorizontal: 15, marginBottom: 15, borderRadius: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#F8F8F8', borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  dayTitle: { fontSize: 18, fontWeight: 'bold', color: '#333333' },
  dayActions: { flexDirection: 'row' },
  allDayButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#E3F2FD', borderRadius: 15, marginLeft: 10 },
  allDayButtonText: { color: '#007AFF', fontSize: 14 },
  noneDayButton: { backgroundColor: '#FFEBEE' },
  noneDayButtonText: { color: '#FF3B30', fontSize: 14 },
  timeSlots: { padding: 10 },
  timeSlot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginVertical: 5 },
  availableSlot: { backgroundColor: '#F0FFF0', borderWidth: 1, borderColor: '#CCFFCC' },
  unavailableSlot: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCCCC' },
  slotInfo: { flex: 1 },
  slotLabel: { fontSize: 16, fontWeight: '500', color: '#333333' },
  slotTime: { fontSize: 14, color: '#666666', marginTop: 2 },
  slotStatus: { marginLeft: 10 },
  footer: { padding: 15, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEEEEE' },
  saveButton: { backgroundColor: '#007AFF', borderRadius: 10, padding: 15, alignItems: 'center' },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
  rowRTL: { flexDirection: 'row-reverse' },
});

export default AvailabilityScreen;