// src/components/CityMultiSelector.js
// ✅ COMPOSANT DE SÉLECTION MULTIPLE DE VILLES

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Searchbar, Checkbox, Chip, Divider } from 'react-native-paper';
import { ISRAEL_CITIES_BY_ZONE } from '../config/constants';

const CityMultiSelector = ({ selectedCities = [], onChange, style }) => {
  const [search, setSearch] = useState('');
  
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
      <Searchbar
        placeholder="Rechercher une ville..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchBar}
      />
      
      {/* Villes sélectionnées (chips) */}
      {selectedCities.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedTitle}>
            ✓ {selectedCities.length} ville{selectedCities.length > 1 ? 's' : ''} sélectionnée{selectedCities.length > 1 ? 's' : ''}
          </Text>
          <View style={styles.chipsContainer}>
            {selectedCities.map(city => (
              <Chip
                key={city}
                style={styles.chip}
                onClose={() => removeCity(city)}
                closeIcon="close"
              >
                {city}
              </Chip>
            ))}
          </View>
          <Divider style={styles.divider} />
        </View>
      )}
      
      {/* Liste des villes par zone */}
      <ScrollView style={styles.citiesList}>
        {filteredZones.map(zone => (
          <View key={zone.zone} style={styles.zoneContainer}>
            <Text style={styles.zoneTitle}>{zone.zone}</Text>
            
            {zone.cities.map(city => (
              <Checkbox.Item
                key={city}
                label={city}
                status={selectedCities.includes(city) ? 'checked' : 'unchecked'}
                onPress={() => toggleCity(city)}
                style={styles.checkboxItem}
              />
            ))}
          </View>
        ))}
        
        {filteredZones.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucune ville trouvée</Text>
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
  searchBar: {
    marginBottom: 15,
    elevation: 2,
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
  chip: {
    margin: 4,
    backgroundColor: '#E8F5E9',
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
  checkboxItem: {
    paddingLeft: 20,
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
});

export default CityMultiSelector;
