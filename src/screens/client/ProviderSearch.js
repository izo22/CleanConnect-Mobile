// src/screens/client/ProviderSearch.js
// ✅ VERSION MODERNE - Navigation intégrée dans le header coloré
// ✅ Plus de barre bleue séparée - tout est dans le rectangle vert

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
import { getServiceColor } from '../../config/constants';

const ProviderSearch = ({ navigation }) => {
  const { currentBooking, selectProvider } = useContext(BookingContext);
  const { userInfo } = useContext(AuthContext);
  
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const serviceType = currentBooking?.serviceType || 'home';
  const serviceColor = getServiceColor(serviceType);

  const normalizeServiceType = (type) => {
    if (!type) return null;
    
    const normalization = {
      'maison': 'home',
      'bureau': 'office',
      'immeuble': 'building',
      'airbnb': 'airbnb',
      'home': 'home',
      'office': 'office',
      'building': 'building',
      'בית': 'home',
      'משרד': 'office',
      'בניין': 'building',
      'אירבנב': 'airbnb',
    };
    
    if (normalization[type]) {
      return normalization[type];
    }
    
    return normalization[type.toLowerCase()] || type;
  };

  const translateServiceType = (type) => {
    const normalizedType = normalizeServiceType(type);
    
    const translations = {
      'home': 'ניקיון בית',
      'office': 'ניקיון משרדים',
      'building': 'ניקיון בניינים',
      'airbnb': 'ניקיון אירבנב',
    };
    
    return translations[normalizedType] || type;
  };

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    if (!providers || providers.length === 0) {
      setFilteredProviders([]);
      return;
    }
    
    let clientCity = null;
    
    if (userInfo?.city) {
      clientCity = userInfo.city;
    } else if (currentBooking?.address?.city) {
      clientCity = currentBooking.address.city;
    } else if (currentBooking?.address?.fullAddress) {
      const parts = currentBooking.address.fullAddress.split(',');
      if (parts.length >= 2) {
        clientCity = parts[1].trim();
      }
    }
    
    if (!clientCity) {
      let filtered = filterByServiceType(providers);
      setFilteredProviders(filtered);
      return;
    }
    
    let filtered = providers.filter(provider => {
      if (!provider.serviceCities || !Array.isArray(provider.serviceCities)) {
        return false;
      }
      
      return provider.serviceCities.includes(clientCity);
    });
    
    filtered = filterByServiceType(filtered);
    setFilteredProviders(filtered);
  }, [providers, currentBooking, userInfo, serviceType]);

  const filterByServiceType = (providersList) => {
    const normalizedSearchType = normalizeServiceType(serviceType);
    
    return providersList.filter(provider => {
      if (provider.serviceTypes && Array.isArray(provider.serviceTypes)) {
        return provider.serviceTypes.some(type => {
          const normalizedProviderType = normalizeServiceType(type);
          return normalizedProviderType === normalizedSearchType;
        });
      }
      
      if (provider.serviceDetails && Array.isArray(provider.serviceDetails)) {
        return provider.serviceDetails.some(service => 
          normalizeServiceType(service.type) === normalizedSearchType
        );
      }
      
      return false;
    });
  };

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await providerService.getAllProviders();
      setProviders(data);
    } catch (err) {
      console.error('❌ שגיאה בטעינת ספקים:', err);
      setError('לא ניתן לטעון את הספקים');
      Alert.alert('שגיאה', 'לא ניתן לטעון את הספקים');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProvider = (provider) => {
    if (selectProvider && typeof selectProvider === 'function') {
      selectProvider(provider);
      
      navigation.navigate('ScheduleScreen', { 
        providerId: provider._id,
        providerName: `${provider.firstName} ${provider.lastName}`,
        hourlyRate: provider.hourlyRate
      });
      
    } else {
      Alert.alert(
        'שגיאת תצורה',
        'פונקציית בחירת הספק אינה זמינה. אנא בדוק את BookingContext.',
        [{ text: 'אישור' }]
      );
    }
  };

  const getServiceLabel = (type) => {
    const labels = {
      home: 'ניקיון בית',
      office: 'ניקיון משרדים',
      building: 'ניקיון בניינים',
      airbnb: 'ניקיון אירבנב',
    };
    return labels[type] || type;
  };

  const getServiceSpecificRate = (provider, searchType) => {
    const normalizedSearchType = normalizeServiceType(searchType);
    
    if (provider.serviceDetails?.length > 0) {
      const service = provider.serviceDetails.find(
        s => normalizeServiceType(s.type) === normalizedSearchType
      );
      if (service?.hourlyRate) {
        return service.hourlyRate;
      }
    }
    
    if (provider.services?.length > 0) {
      const service = provider.services.find(
        s => normalizeServiceType(s.type) === normalizedSearchType
      );
      if (service?.hourlyRate) {
        return service.hourlyRate;
      }
    }
    
    if (provider.price && typeof provider.price === 'object') {
      const rate = provider.price[normalizedSearchType];
      if (rate) {
        return rate;
      }
    }
    
    return provider.hourlyRate || 0;
  };

  const renderProviderCard = ({ item }) => {
    const serviceRate = getServiceSpecificRate(item, serviceType);
    
    return (
      <TouchableOpacity
        style={styles.providerCard}
        onPress={() => handleSelectProvider(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.providerHeader}>
            {item.profilePicture ? (
              <Image
                source={{ uri: item.profilePicture }}
                style={styles.profilePicture}
              />
            ) : (
              <View style={styles.profilePicturePlaceholder}>
                <Ionicons name="person" size={32} color="#999" />
              </View>
            )}
            
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>
                {item.firstName} {item.lastName}
              </Text>
              
              {item.serviceCities && item.serviceCities.length > 0 && (
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={14} color={serviceColor} />
                  <Text style={[styles.citiesText, { color: serviceColor }]}>
                    {item.serviceCities.slice(0, 2).join(', ')}
                    {item.serviceCities.length > 2 && ` +${item.serviceCities.length - 2}`}
                  </Text>
                </View>
              )}
              
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.rating}>
                  {item.rating || 'חדש'}
                  {item.reviewCount ? ` (${item.reviewCount})` : ''}
                </Text>
              </View>
            </View>
            
            <View style={styles.priceContainer}>
              <Text style={[styles.price, { color: serviceColor }]}>₪{serviceRate}</Text>
              <Text style={styles.priceLabel}>לשעה</Text>
            </View>
          </View>
          
          {item.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {item.bio}
            </Text>
          )}
          
          <View style={styles.serviceTypesContainer}>
            {item.serviceTypes && item.serviceTypes.map((type, index) => {
              const badgeColor = getServiceColor(type);
              
              return (
                <View 
                  key={index} 
                  style={[
                    styles.modernBadge,
                    { 
                      backgroundColor: `${badgeColor}15`,
                      borderColor: `${badgeColor}40`,
                    }
                  ]}
                >
                  <Text style={[styles.modernBadgeText, { color: badgeColor }]}>
                    {translateServiceType(type)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={serviceColor} />
        <Text style={styles.loadingText}>מחפש ספקים...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={64} color="#ff6b6b" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={[styles.modernButton, { backgroundColor: serviceColor }]} 
          onPress={loadProviders}
        >
          <Text style={styles.modernButtonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const clientCity = userInfo?.city || currentBooking?.address?.city || 
                     (currentBooking?.address?.fullAddress?.split(',')[1]?.trim());

  return (
    <View style={styles.container}>
      {/* ✅ HEADER MODERNE AVEC NAVIGATION INTÉGRÉE */}
      <View style={[styles.header, { backgroundColor: serviceColor }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-forward" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>ספקים זמינים</Text>
            <Text style={styles.headerSubtitle}>
              {getServiceLabel(serviceType)}
              {clientCity ? ` ב${clientCity}` : ''}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.resultsBadge}>
          <Text style={styles.resultsBadgeText}>
            {filteredProviders.length} {filteredProviders.length === 1 ? 'ספק' : 'ספקים'}
          </Text>
        </View>
      </View>

      {filteredProviders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search" size={64} color="#E0E0E0" />
          </View>
          <Text style={styles.emptyText}>
            {clientCity 
              ? `אין ספקים זמינים ב${clientCity}`
              : 'לא נמצאו ספקים'}
          </Text>
          <Text style={styles.emptySubtext}>
            {clientCity 
              ? 'נסה לחפש בעיר סמוכה'
              : 'בדוק את העיר בפרופיל שלך'}
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
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '500',
  },
  modernButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  modernButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // ✅ HEADER MODERNE AVEC NAVIGATION INTÉGRÉE
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  resultsBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backdropFilter: 'blur(10px)',
  },
  resultsBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  providerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  profilePicture: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  profilePicturePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  providerInfo: {
    flex: 1,
    marginRight: 16,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'right',
  },
  locationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 4,
  },
  citiesText: {
    fontSize: 13,
    marginRight: 4,
    textAlign: 'right',
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  rating: {
    marginRight: 4,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  bio: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  serviceTypesContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  modernBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginLeft: 0,
    marginTop: 0,
  },
  modernBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default ProviderSearch;