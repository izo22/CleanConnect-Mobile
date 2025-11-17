// src/screens/client/ProviderSearch.js
// ✅ FILTRAGE UNIQUEMENT PAR VILLE DU CLIENT

import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookingContext } from '../../context/BookingContext';
import { AuthContext } from '../../context/AuthContext';
import providerService from '../../services/providerService';

const ProviderSearch = ({ navigation }) => {
  const { currentBooking, selectProvider } = useContext(BookingContext);
  const { userInfo } = useContext(AuthContext);
  
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const serviceType = currentBooking?.serviceType || 'home';

  // Charger tous les prestataires au démarrage
  useEffect(() => {
    loadProviders();
  }, []);

  // ✅ FILTRAGE AUTOMATIQUE PAR VILLE DU CLIENT
  useEffect(() => {
    
    if (!providers || providers.length === 0) {
      setFilteredProviders([]);
      return;
    }
    
    // Récupérer la ville du client
    const clientCity = currentBooking?.address?.city || userInfo?.city || 'Tel Aviv';
    
    
    if (!clientCity) {
      // Filtrer quand même par type de service
      let filtered = filterByServiceType(providers);
      setFilteredProviders(filtered);
      return;
    }
    
    // ✅ FILTRAGE PAR VILLE
    let filtered = providers.filter(provider => {
      // Vérifier si le prestataire a des villes configurées
      if (!provider.serviceCities || !Array.isArray(provider.serviceCities)) {
        return false;
      }
      
      // Vérifier si la ville du client est dans les villes du prestataire
      const coversCity = provider.serviceCities.includes(clientCity);
      
      if (coversCity) {
      } else {
      }
      
      return coversCity;
    });
    
    
    // Filtrer aussi par type de service
    filtered = filterByServiceType(filtered);
    
    
    setFilteredProviders(filtered);
  }, [providers, currentBooking, userInfo, serviceType]);

  // Fonction pour filtrer par type de service
  const filterByServiceType = (providersList) => {
    return providersList.filter(provider => {
      const serviceTypeMapping = {
        'home': 'maison',
        'office': 'bureau',
        'building': 'immeuble',
      };
      
      const mappedServiceType = serviceTypeMapping[serviceType] || serviceType;
      
      // Vérifier dans serviceTypes
      if (provider.serviceTypes && Array.isArray(provider.serviceTypes)) {
        return provider.serviceTypes.includes(mappedServiceType);
      }
      
      // Vérifier dans serviceDetails
      if (provider.serviceDetails && Array.isArray(provider.serviceDetails)) {
        return provider.serviceDetails.some(service => service.type === mappedServiceType);
      }
      
      return true; // Si pas de données, on garde le prestataire
    });
  };

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await providerService.getAllProviders();
      
      setProviders(data);
    } catch (err) {
      setError('Impossible de charger les prestataires');
      Alert.alert('Erreur', 'Impossible de charger les prestataires');
    } finally {
      setLoading(false);
    }
  };

  // ✅ CORRECTION : Navigation vers ScheduleScreen
  const handleSelectProvider = (provider) => {
    
    // ✅ Vérifier que selectProvider existe et est une fonction
    if (selectProvider && typeof selectProvider === 'function') {
      selectProvider(provider);
      
      // ✅ CORRECTION : Naviguer vers ScheduleScreen avec les infos du prestataire
      navigation.navigate('ScheduleScreen', { 
        providerId: provider._id,
        providerName: `${provider.firstName} ${provider.lastName}`,
        hourlyRate: provider.hourlyRate
      });
      
    } else {
      Alert.alert(
        'Erreur de configuration',
        'La fonction de sélection du prestataire n\'est pas disponible. Veuillez vérifier le BookingContext.',
        [
          {
            text: 'OK',
          }
        ]
      );
    }
  };

  const getServiceLabel = (type) => {
    const labels = {
      home: 'Nettoyage à domicile',
      office: 'Nettoyage de bureaux',
      building: 'Nettoyage d\'immeubles',
    };
    return labels[type] || type;
  };

  const renderProviderCard = ({ item }) => {
    // ✅ Construire le nom complet
    const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Prestataire';
    
    return (
      <TouchableOpacity
        style={styles.providerCard}
        onPress={() => handleSelectProvider(item)}
      >
        <View style={styles.providerHeader}>
          {item.profilePicture ? (
            <Image
              source={{ uri: item.profilePicture }}
              style={styles.profilePicture}
            />
          ) : (
            <View style={styles.profilePicturePlaceholder}>
              <Ionicons name="person" size={40} color="#666" />
            </View>
          )}
          
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{fullName}</Text>
            
            {/* Afficher les villes couvertes */}
            {item.serviceCities && item.serviceCities.length > 0 && (
              <View style={styles.citiesContainer}>
                <Ionicons name="location" size={14} color="#2196F3" />
                <Text style={styles.citiesText}>
                  {item.serviceCities.slice(0, 3).join(', ')}
                  {item.serviceCities.length > 3 ? ` +${item.serviceCities.length - 3}` : ''}
                </Text>
              </View>
            )}
            
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.rating}>
                {item.rating || 'Nouveau'}
                {item.reviewCount ? ` (${item.reviewCount})` : ''}
              </Text>
            </View>
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{item.hourlyRate || 0}₪</Text>
            <Text style={styles.priceLabel}>/heure</Text>
          </View>
        </View>
        
        {item.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {item.bio}
          </Text>
        )}
        
        <View style={styles.serviceTypesContainer}>
          {item.serviceTypes && item.serviceTypes.map((type, index) => (
            <View key={index} style={styles.serviceTypeBadge}>
              <Text style={styles.serviceTypeText}>{type}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
        <Text style={styles.loadingText}>Recherche des prestataires...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={64} color="#ff6b6b" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProviders}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const clientCity = currentBooking?.address?.city || userInfo?.city;

  return (
    <View style={styles.container}>
      {/* En-tête avec info de recherche */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prestataires disponibles</Text>
        <Text style={styles.headerSubtitle}>
          {getServiceLabel(serviceType)}
          {clientCity ? ` à ${clientCity}` : ''}
        </Text>
        <Text style={styles.resultsCount}>
          {filteredProviders.length} prestataire{filteredProviders.length > 1 ? 's' : ''} trouvé{filteredProviders.length > 1 ? 's' : ''}
        </Text>
      </View>

      {filteredProviders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={64} color="#ccc" />
          <Text style={styles.emptyText}>
            {clientCity 
              ? `Aucun prestataire disponible à ${clientCity}`
              : 'Aucun prestataire trouvé'}
          </Text>
          <Text style={styles.emptySubtext}>
            {clientCity 
              ? 'Essayez de chercher dans une ville voisine'
              : 'Vérifiez votre ville dans votre profil'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProviders}
          renderItem={renderProviderCard}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#4a90e2',
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  resultsCount: {
    fontSize: 14,
    color: '#4a90e2',
    marginTop: 5,
    fontWeight: '600',
  },
  listContainer: {
    padding: 15,
  },
  providerCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  profilePicture: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profilePicturePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  citiesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  citiesText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    marginLeft: 5,
    fontSize: 14,
    color: '#666',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a90e2',
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
  },
  bio: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20,
  },
  serviceTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serviceTypeBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 5,
    marginTop: 5,
  },
  serviceTypeText: {
    fontSize: 12,
    color: '#1976d2',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 10,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default ProviderSearch;
