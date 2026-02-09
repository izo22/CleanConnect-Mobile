// src/components/CityMultiSelector.js
// ✅ COMPOSANT DE SÉLECTION MULTIPLE DE VILLES - 100% NATIVE
// ✅ תוקן: Version sans react-native-paper pour éviter toutes les erreurs de variant

import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TextInput,
  TouchableOpacity,
  Text 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ISRAEL_CITIES_BY_ZONE } from '../config/constants';

// ✅ Composant Chip custom (remplace react-native-paper Chip)
const CustomChip = ({ children, onClose }) => {
  return (
    <View style={styles.customChip}>
      <Text style={styles.customChipText}>{children}</Text>
      <TouchableOpacity onPress={onClose} style={styles.customChipClose}>
        <Ionicons name="close-circle" size={18} color="#4CAF50" />
      </TouchableOpacity>
    </View>
  );
};

// ✅ Composant Searchbar custom (remplace react-native-paper Searchbar)
const CustomSearchbar = ({ placeholder, value, onChangeText, style }) => {
  return (
    <View style={[styles.customSearchbar, style]}>
      <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#999"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={20} color="#999" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ✅ Composant CheckboxItem custom
const CustomCheckboxItem = ({ label, checked, onPress, isRTL }) => {
  return (
    <TouchableOpacity 
      style={styles.customCheckboxItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.customCheckbox,
        checked && styles.customCheckboxChecked
      ]}>
        {checked && (
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        )}
      </View>
      <Text style={[styles.customCheckboxLabel, isRTL && styles.textRTL]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ✅ Composant Divider custom
const CustomDivider = ({ style }) => {
  return <View style={[styles.customDivider, style]} />;
};

const CityMultiSelector = ({ selectedCities = [], onChange, style }) => {
  const [search, setSearch] = useState('');
  const isRTL = true;
  
  // Fonction pour cocher/décocher une ville
  const toggleCity = (city) => {
    if (selectedCities.includes(city)) {
      // Retirer la ville
      onChange(selectedCities.filter(c => c !== city));
    } else {
      // Ajouter la ville
      onChange([...selectedCities, city]);
    }
  };
  
  // Retirer une ville depuis les chips
  const removeCity = (city) => {
    onChange(selectedCities.filter(c => c !== city));
  };
  
  // Filtrer les zones et villes selon la recherche
  const filteredZones = ISRAEL_CITIES_BY_ZONE.map(zone => ({
    ...zone,
    cities: zone.cities.filter(city =>
      city.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(zone => zone.cities.length > 0);
  
  return (
    <View style={[styles.container, style]}>
      {/* Barre de recherche */}
      <CustomSearchbar
        placeholder="חפש עיר..."
        value={search}
        onChangeText={setSearch}
        style={[styles.searchBar, isRTL && styles.searchBarRTL]}
      />
      
      {/* Villes sélectionnées (chips) */}
      {selectedCities.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={[styles.selectedTitle, isRTL && styles.textRTL]}>
            ✓ {selectedCities.length} {selectedCities.length === 1 ? 'עיר נבחרה' : 'ערים נבחרו'}
          </Text>
          <View style={styles.chipsContainer}>
            {selectedCities.map(city => (
              <CustomChip
                key={city}
                onClose={() => removeCity(city)}
              >
                {city}
              </CustomChip>
            ))}
          </View>
          <CustomDivider style={styles.divider} />
        </View>
      )}
      
      {/* Liste des villes par zone */}
      <ScrollView style={styles.citiesList}>
        {filteredZones.map(zone => (
          <View key={zone.zone} style={styles.zoneContainer}>
            <Text style={[styles.zoneTitle, isRTL && styles.textRTL]}>{zone.zone}</Text>
            
            {zone.cities.map(city => (
              <CustomCheckboxItem
                key={city}
                label={city}
                checked={selectedCities.includes(city)}
                onPress={() => toggleCity(city)}
                isRTL={isRTL}
              />
            ))}
          </View>
        ))}
        
        {filteredZones.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
              לא נמצאו ערים
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ✅ Styles pour CustomSearchbar
  customSearchbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
  },
  searchBar: {
    marginBottom: 15,
  },
  searchBarRTL: {
    textAlign: 'right',
  },
  selectedContainer: {
    marginBottom: 15,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  // ✅ Styles pour CustomChip
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  customChipText: {
    fontSize: 14,
    color: '#2E7D32',
    marginRight: 6,
  },
  customChipClose: {
    marginLeft: 4,
  },
  // ✅ Styles pour CustomDivider
  customDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 10,
  },
  divider: {
    height: 1,
    marginTop: 10,
  },
  citiesList: {
    flex: 1,
  },
  zoneContainer: {
    marginBottom: 20,
  },
  zoneTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
    paddingLeft: 10,
  },
  // ✅ Styles pour CustomCheckboxItem
  customCheckboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  customCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#2196F3',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  customCheckboxChecked: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  customCheckboxLabel: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default CityMultiSelector;