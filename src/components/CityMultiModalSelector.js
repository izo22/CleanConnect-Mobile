// src/components/CityMultiModalSelector.js
// ✅ Modal professionnel pour sélection MULTIPLE de villes avec RTL

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
  ScrollView,
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

const CityMultiModalSelector = ({ visible, onClose, onConfirm, selectedCities = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSelectedCities, setTempSelectedCities] = useState(selectedCities);

  // Reset temp selection when modal opens
  React.useEffect(() => {
    if (visible) {
      setTempSelectedCities(selectedCities);
      setSearchQuery('');
    }
  }, [visible, selectedCities]);

  // Filtrage des villes
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return CITIES;
    return CITIES.filter(city =>
      city.includes(searchQuery.trim())
    );
  }, [searchQuery]);

  // Toggle ville
  const toggleCity = (city) => {
    if (tempSelectedCities.includes(city)) {
      setTempSelectedCities(tempSelectedCities.filter(c => c !== city));
    } else {
      setTempSelectedCities([...tempSelectedCities, city]);
    }
  };

  // Retirer une ville depuis les chips
  const removeCity = (city) => {
    setTempSelectedCities(tempSelectedCities.filter(c => c !== city));
  };

  // Confirmer la sélection
  const handleConfirm = () => {
    onConfirm(tempSelectedCities);
    onClose();
  };

  // Annuler
  const handleCancel = () => {
    setTempSelectedCities(selectedCities);
    setSearchQuery('');
    onClose();
  };

  const renderCityItem = ({ item }) => {
    const isSelected = tempSelectedCities.includes(item);
    
    return (
      <TouchableOpacity
        style={styles.cityItem}
        onPress={() => toggleCity(item)}
        activeOpacity={0.7}
      >
        <View style={styles.checkboxContainer}>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? '#4a90e2' : '#999'}
          />
        </View>
        <Text style={[
          styles.cityText,
          isSelected && styles.cityTextSelected
        ]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.modalContainer}>
        <StatusBar barStyle="dark-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCancel}
          >
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>בחר עיריות</Text>
          
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>אישור</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Cities Chips */}
        {tempSelectedCities.length > 0 && (
          <View style={styles.selectedContainer}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedCount}>
                {tempSelectedCities.length} עיריות נבחרו
              </Text>
              <TouchableOpacity
                onPress={() => setTempSelectedCities([])}
              >
                <Text style={styles.clearAllText}>נקה הכל</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
            >
              {tempSelectedCities.map(city => (
                <View key={city} style={styles.chip}>
                  <Text style={styles.chipText}>{city}</Text>
                  <TouchableOpacity
                    onPress={() => removeCity(city)}
                    style={styles.chipClose}
                  >
                    <Ionicons name="close-circle" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

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

        {/* Footer */}
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
  confirmButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#4a90e2',
    borderRadius: 6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedContainer: {
    backgroundColor: '#f0f8ff',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a90e2',
  },
  clearAllText: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '600',
  },
  chipsContainer: {
    flexDirection: 'row-reverse',
    paddingVertical: 5,
  },
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#4a90e2',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  chipText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 6,
  },
  chipClose: {
    marginLeft: 4,
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkboxContainer: {
    marginLeft: 15,
  },
  cityText: {
    flex: 1,
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

export default CityMultiModalSelector;