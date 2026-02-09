// src/components/CityModalSelector.js
// ✅ Modal professionnel pour sélection de ville avec RTL

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Liste complète des villes israéliennes
const CITIES = [
  // Centre
  'תל אביב-יפו', 'רמת גן', 'גבעתיים', 'בני ברק', 'חולון', 'בת ים', 'ראשון לציון',
  'רחובות', 'נס ציונה', 'רמלה', 'לוד', 'יבנה', 'גדרה', 'קריית עקרון',
  
  // Métropole Tel Aviv
  'הרצליה', 'רעננה', 'כפר סבא', 'הוד השרון', 'רמת השרון', 'פתח תקווה', 
  'ראש העין', 'יהוד-מונוסון', 'אור יהודה', 'אזור',
  
  // Haïfa et Nord
  'חיפה', 'קריית אתא', 'קריית ביאליק', 'קריית ים', 'קריית מוצקין', 
  'נהריה', 'עכו', 'כרמיאל', 'מעלות-תרשיחא', 'טבריה', 'צפת', 'קצרין',
  
  // Jérusalem et environs
  'ירושלים', 'בית שמש', 'מעלה אדומים', 'מודיעין-מכבים-רעות', 'מודיעין עילית',
  
  // Sud
  'באר שבע', 'אשדוד', 'אשקלון', 'קריית גת', 'שדרות', 'נתיבות', 'אילת', 
  'ערד', 'דימונה', 'אופקים', 'קריית מלאכי',
  
  // Sharon
  'נתניה', 'חדרה', 'עתלית', 'זכרון יעקב', 'קיסריה', 'פרדס חנה-כרכור', 
  'אור עקיבא', 'בנימינה-גבעת עדה',
  
  // Centre-Est
  'אריאל', 'מעלה אפרים', 'בית אל', 'גבעת זאב',
  
  // Villes arabes
  'נצרת', 'שפרעם', 'טמרה', 'סכנין', 'ערערה', 'באקה אל-גרביה', 'אום אל-פחם',
  'טייבה', 'כפר קאסם', 'כפר קרע', 'רהט', 'חורה', 'כסיפה', 'לקיה',
].sort();

const CityModalSelector = ({ visible, onClose, onSelect, selectedCity }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrage des villes
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return CITIES;
    return CITIES.filter(city =>
      city.includes(searchQuery.trim())
    );
  }, [searchQuery]);

  const handleSelectCity = (city) => {
    onSelect(city);
    setSearchQuery('');
    onClose();
  };

  const renderCityItem = ({ item }) => {
    const isSelected = item === selectedCity;
    
    return (
      <TouchableOpacity
        style={[
          styles.cityItem,
          isSelected && styles.cityItemSelected
        ]}
        onPress={() => handleSelectCity(item)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.cityText,
          isSelected && styles.cityTextSelected
        ]}>
          {item}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#4a90e2" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <StatusBar barStyle="dark-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>בחר עיר</Text>
          
          <View style={{ width: 28 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="חפש עיר..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Cities List */}
        <FlatList
          data={filteredCities}
          renderItem={renderCityItem}
          keyExtractor={(item) => item}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>לא נמצאו עיריות</Text>
            </View>
          }
        />

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {filteredCities.length} עיריות זמינות
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    margin: 15,
    paddingHorizontal: 15,
    height: 50,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginLeft: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    textAlign: 'right',
    color: '#333',
  },
  clearButton: {
    padding: 5,
    marginRight: 5,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  cityItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cityItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  cityText: {
    fontSize: 17,
    color: '#333',
    textAlign: 'right',
  },
  cityTextSelected: {
    color: '#4a90e2',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#999',
  },
  footer: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default CityModalSelector;