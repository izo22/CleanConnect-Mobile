// src/screens/client/ProviderSearch.js
// ✅ FIX : serviceCities → serviceAreas (mismatch avec le modèle Provider.js)
// 🔍 VERSION DEBUG — logs temporaires pour diagnostiquer le filtre ville
// ✅ MODIFIÉ: Affichage de la bio du prestataire dans la card
// ✅ MODIFIÉ: providerBio passé dans la navigation vers ScheduleScreen

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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookingContext } from '../../context/BookingContext';
import { AuthContext } from '../../context/AuthContext';
import providerService from '../../services/providerService';
import { getServiceColor, getServiceBackgroundColor } from '../../config/constants';

const ProviderSearch = ({ navigation }) => {
  const { currentBooking, selectProvider } = useContext(BookingContext);
  const { userInfo } = useContext(AuthContext);
  
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const serviceType = currentBooking?.serviceType || 'home';
  const serviceColor = getServiceColor(serviceType);
  const serviceBgColor = getServiceBackgroundColor(serviceType);

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
    
    if (normalization[type]) return normalization[type];
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
    if (!searchQuery.trim()) {
      setFilteredProviders(providers);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredProviders(
      providers.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, providers]);

  const loadProviders = async () => {
    const clientCity  = userInfo?.city ?? null;
    const sType       = currentBooking?.serviceType || 'home';
  
    console.log('═══════════ PROVIDER SEARCH DEBUG ═══════════');
    console.log('[1] userInfo :', JSON.stringify(userInfo, null, 2));
    console.log('[2] clientCity :', clientCity);
    console.log('[3] serviceType :', sType);
  
    if (!clientCity) {
      console.warn('[!] clientCity est null — filtre ville non appliqué');
    }
  
    try {
      const response = await providerService.getAllProviders(clientCity, sType);
  
      console.log('[4] Réponse brute API :', JSON.stringify(response, null, 2));
      console.log('[5] Nombre de prestataires :', response?.length ?? 0);
  
      setProviders(response ?? []);
      setFilteredProviders(response ?? []);
    } catch (err) {
      console.error('[!] Erreur loadProviders :', err.message);
      setError('שגיאה בטעינת הספקים');
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
        hourlyRate: provider.hourlyRate,
        providerBio: provider.bio, // ✅ AJOUT
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
      if (service?.hourlyRate) return service.hourlyRate;
    }
    if (provider.services?.length > 0) {
      const service = provider.services.find(
        s => normalizeServiceType(s.type) === normalizedSearchType
      );
      if (service?.hourlyRate) return service.hourlyRate;
    }
    if (provider.price && typeof provider.price === 'object') {
      const rate = provider.price[normalizedSearchType];
      if (rate) return rate;
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
              <View style={[
                styles.profilePicturePlaceholder,
                { backgroundColor: `${serviceColor}10`, borderColor: `${serviceColor}30` }
              ]}>
                <Ionicons name="person" size={24} color={serviceColor} />
              </View>
            )}
            
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>
                {item.firstName} {item.lastName}
              </Text>
              
              {item.serviceAreas && item.serviceAreas.length > 0 && (
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={12} color="#9CA3AF" />
                  <Text style={styles.citiesText}>
                    {item.serviceAreas.slice(0, 2).join(', ')}
                  </Text>
                </View>
              )}
              
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color="#FCD34D" />
                <Text style={styles.rating}>
                  {item.rating || 'חדש'}
                </Text>
              </View>

              {item.bio ? (
                <Text style={styles.bioText} numberOfLines={2}>
                  {item.bio}
                </Text>
              ) : null}
            </View>
            
            <View style={styles.priceContainer}>
              <Text style={[styles.price, { color: serviceColor }]}>₪{serviceRate}</Text>
              <Text style={styles.priceLabel}>לשעה</Text>
            </View>
          </View>
          
          <View style={styles.serviceTypesContainer}>
            {item.serviceTypes && item.serviceTypes.map((type, index) => {
              const badgeColor = getServiceColor(type);
              return (
                <View
                  key={index}
                  style={[styles.modernBadge, { backgroundColor: `${badgeColor}10` }]}
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
      <View style={[styles.centerContainer, { backgroundColor: serviceBgColor }]}>
        <ActivityIndicator size="large" color={serviceColor} />
        <Text style={styles.loadingText}>מחפש ספקים...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: serviceBgColor }]}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
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

  const clientCity =
    userInfo?.city ||
    currentBooking?.address?.city ||
    currentBooking?.address?.fullAddress?.split(',')[1]?.trim();

  return (
    <View style={[styles.container, { backgroundColor: serviceBgColor }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-forward" size={24} color="#111827" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>ספקים זמינים</Text>
          <Text style={styles.headerSubtitle}>
            {getServiceLabel(serviceType)}
            {clientCity ? ` ב${clientCity}` : ''}
          </Text>
        </View>
      </View>

      {/* BARRE DE RECHERCHE */}
      <View style={[styles.searchContainer, { borderColor: `${serviceColor}30` }]}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="חיפוש..."
          placeholderTextColor="#D1D5DB"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredProviders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={48} color={`${serviceColor}40`} />
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '400',
  },
  modernButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modernButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginRight: -28,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '400',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchIcon: {
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '400',
    textAlign: 'right',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 40,
  },
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  profilePicturePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  providerInfo: {
    flex: 1,
    marginRight: 12,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  locationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 3,
  },
  citiesText: {
    fontSize: 11,
    marginRight: 3,
    textAlign: 'right',
    color: '#9CA3AF',
    fontWeight: '400',
  },
  ratingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  rating: {
    marginRight: 3,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '400',
  },
  bioText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 16,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 1,
    letterSpacing: -0.3,
  },
  priceLabel: {
    fontSize: 10,
    color: '#D1D5DB',
    fontWeight: '400',
  },
  serviceTypesContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  modernBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modernBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '400',
  },
});

export default ProviderSearch;