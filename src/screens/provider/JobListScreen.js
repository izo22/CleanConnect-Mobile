// JobListScreen.js - CORRIGÉ pour synchronisation avec RequestsScreen

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import JobCard from './components/JobCard';
import { providerService } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const JobListScreen = ({ navigation }) => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, activeFilter, jobs]);

  // 🔧 NOUVELLE FONCTION - Lecture synchronisée avec RequestsScreen
  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 🔄 ÉTAPE 1 : Récupérer l'ID du prestataire depuis AsyncStorage (comme RequestsScreen)
      let providerId = null;
      
      try {
        // Méthode 1 : Essayer l'API si disponible
        const response = await fetch('/api/providers/profile', {
          headers: {
            'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          providerId = data.data?._id;
        }
      } catch (apiError) {
      }
      
      // Méthode 2 : Fallback AsyncStorage
      if (!providerId) {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          providerId = user.id || user._id;
        }
      }
      
      if (!providerId) {
        throw new Error('ID prestataire introuvable');
      }

      // 🔄 ÉTAPE 2 : Lire les demandes depuis AsyncStorage (même source que RequestsScreen)
      const storageKey = `provider_requests_${providerId}`;
      
      const savedRequests = await AsyncStorage.getItem(storageKey);
      
      let allRequests = [];
      if (savedRequests) {
        allRequests = JSON.parse(savedRequests);
      } else {
      }

      // 🔄 ÉTAPE 3 : Filtrer SEULEMENT les demandes acceptées/confirmées comme missions
      const activeMissions = allRequests.filter(request => 
        ['accepted', 'confirmed', 'in-progress'].includes(request.status)
      );
      
     
      // 🔄 ÉTAPE 4 : Transformer le format pour compatibilité avec JobCard
      const formattedJobs = activeMissions.map(mission => ({
        id: mission._id,
        clientName: mission.clientName,
        serviceName: getServiceName(mission.serviceType),
        serviceType: mission.serviceType,
        address: mission.address?.fullAddress || 'Adresse non spécifiée',
        date: mission.dateTime,
        duration: mission.duration,
        price: mission.price,
        status: mission.status,
        notes: mission.notes || '',
        clientId: mission.clientId
      }));

      // 🔄 ÉTAPE 5 : Trier par date (les plus récentes d'abord)
      const sortedJobs = formattedJobs.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setJobs(sortedJobs);
      setFilteredJobs(sortedJobs);
      
    } catch (err) {
      setError('Impossible de charger les missions. Vérifiez vos demandes acceptées.');
      setJobs([]);
      setFilteredJobs([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔧 FONCTION UTILITAIRE - Conversion du type de service en nom
  const getServiceName = (serviceType) => {
    const serviceNames = {
      'home': 'Nettoyage domicile',
      'office': 'Nettoyage bureau', 
      'building': 'Nettoyage immeuble',
      'commercial': 'Nettoyage commercial'
    };
    return serviceNames[serviceType] || 'Service de nettoyage';
  };

  // Appliquer les filtres et la recherche
  const applyFilters = () => {
    let result = [...jobs];
    
    // Appliquer le filtre de statut
    if (activeFilter !== 'all') {
      result = result.filter(job => job.status === activeFilter);
    }
    
    // Appliquer la recherche
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        job =>
          job.clientName.toLowerCase().includes(query) ||
          job.address.toLowerCase().includes(query) ||
          job.serviceName.toLowerCase().includes(query)
      );
    }
    
    setFilteredJobs(result);
  };

  // Gérer le rafraîchissement tiré vers le bas
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  // Effacer le champ de recherche
  const clearSearch = () => {
    setSearchQuery('');
  };

  // 🔧 FILTRES ADAPTÉS AUX STATUTS DE MISSIONS
  const filterButtons = [
    { id: 'all', label: 'Toutes', icon: 'list' },
    { id: 'accepted', label: 'Acceptées', icon: 'checkmark-circle' },
    { id: 'confirmed', label: 'Confirmées', icon: 'checkmark-done-circle' },
    { id: 'in-progress', label: 'En cours', icon: 'time' },
    { id: 'completed', label: 'Terminées', icon: 'checkmark-done' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un client ou une adresse"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#999999" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Filtres */}
      <View style={styles.filterButtonsContainer}>
        {filterButtons.map((button) => (
          <TouchableOpacity
            key={button.id}
            style={[
              styles.filterButton,
              activeFilter === button.id && styles.activeFilterButton,
            ]}
            onPress={() => setActiveFilter(button.id)}
          >
            <Ionicons 
              name={button.icon} 
              size={16} 
              color={activeFilter === button.id ? '#FFFFFF' : '#666666'} 
            />
            <Text
              style={[
                styles.filterButtonText,
                activeFilter === button.id && styles.activeFilterButtonText,
              ]}
            >
              {button.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Synchronisation des missions...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle" size={60} color="#F44336" />
          <Text style={styles.emptyText}>{error}</Text>
          <Text style={styles.emptySubtext}>
            Les missions proviennent des demandes acceptées
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadJobs}
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onPress={() => navigation.navigate('JobDetails', { jobId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={60} color="#CCCCCC" />
              <Text style={styles.emptyText}>Aucune mission active</Text>
              <Text style={styles.emptySubtext}>
                Les missions apparaîtront ici quand vous accepterez des demandes de clients
              </Text>
              <TouchableOpacity
                style={styles.viewRequestsButton}
                onPress={() => navigation.navigate('Requests')}
              >
                <Text style={styles.viewRequestsButtonText}>Voir les demandes</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 15,
    marginBottom: 10,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333333',
  },
  clearButton: {
    padding: 5,
  },
  filterButtonsContainer: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#666666',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
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
  listContainer: {
    padding: 15,
    paddingTop: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666666',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  viewRequestsButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  viewRequestsButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default JobListScreen;
