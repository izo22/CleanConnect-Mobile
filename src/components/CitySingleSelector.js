// src/components/CitySingleSelector.js
// ✅ COMPOSANT DE SÉLECTION UNIQUE DE VILLE (POUR CLIENT)

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Searchbar, RadioButton, Divider } from 'react-native-paper';
import { ISRAEL_CITIES_BY_ZONE, ALL_CITIES } from '../config/constants';

const CitySingleSelector = ({ selectedCity = '', onChange, style }) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('zones'); // 'zones' ou 'all'
  
  // Filtrer toutes les villes selon la recherche
  const filteredAllCities = ALL_CITIES.filter(city =>
    city.toLowerCase().includes(search.toLowerCase())
  );
  
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
        placeholder="Rechercher votre ville..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchBar}
      />
      
      {/* Ville sélectionnée */}
      {selectedCity && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>Ville sélectionnée :</Text>
          <Text style={styles.selectedCity}>📍 {selectedCity}</Text>
          <Divider style={styles.divider} />
        </View>
      )}
      
      {/* Toggle view mode */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'zones' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('zones')}
        >
          <Text style={[styles.viewModeText, viewMode === 'zones' && styles.viewModeTextActive]}>
            Par zones
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'all' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('all')}
        >
          <Text style={[styles.viewModeText, viewMode === 'all' && styles.viewModeTextActive]}>
            Liste complète
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Liste des villes */}
      <ScrollView style={styles.citiesList}>
        {viewMode === 'zones' ? (
          // Vue par zones
          filteredZones.map(zone => (
            <View key={zone.zone} style={styles.zoneContainer}>
              <Text style={styles.zoneTitle}>{zone.zone}</Text>
              
              <RadioButton.Group value={selectedCity} onValueChange={onChange}>
                {zone.cities.map(city => (
                  <RadioButton.Item
                    key={city}
                    label={city}
                    value={city}
                    style={styles.radioItem}
                  />
                ))}
              </RadioButton.Group>
            </View>
          ))
        ) : (
          // Liste complète alphabétique
          <RadioButton.Group value={selectedCity} onValueChange={onChange}>
            {filteredAllCities.map(city => (
              <RadioButton.Item
                key={city}
                label={city}
                value={city}
                style={styles.radioItem}
              />
            ))}
          </RadioButton.Group>
        )}
        
        {((viewMode === 'zones' && filteredZones.length === 0) ||
          (viewMode === 'all' && filteredAllCities.length === 0)) && (
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
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  selectedLabel: {
    fontSize: 12,
    color: '#2E7D32',
    marginBottom: 4,
  },
  selectedCity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  divider: {
    height: 1,
    marginTop: 15,
  },
  viewModeContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  viewModeButtonActive: {
    backgroundColor: '#2196F3',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  viewModeTextActive: {
    color: 'white',
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
  radioItem: {
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

export default CitySingleSelector;
