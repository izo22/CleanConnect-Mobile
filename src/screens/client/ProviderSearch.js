// src/screens/client/ProviderSearch.js
// ✅ FIX : serviceCities → serviceAreas (mismatch avec le modèle Provider.js)
// 🔍 VERSION DEBUG — logs temporaires pour diagnostiquer le filtre ville
// ✅ MODIFIÉ: Affichage de la bio du prestataire dans la card
// ✅ MODIFIÉ: providerBio passé dans la navigation vers ScheduleScreen
// ✅ FIX: Suppression du bloc rating (système de notes non implémenté)
// ✅ REFONTE BLEU CLAIR (maquette 02) : note / langues affichées seulement si le backend les fournit
// ✅ Le tap sur une carte ouvre ProviderProfileView (maquette 03) avant ScheduleScreen

import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookingContext } from '../../context/BookingContext';
import { AuthContext } from '../../context/AuthContext';
import providerService from '../../services/providerService';
import { COLORS } from '../../config/theme';
import { PhotoOrPlaceholder, Chip, ScreenHeader, TOP_SPACE } from '../../components/BlueUI';

const ProviderSearch = ({ navigation }) => {
  const { currentBooking, selectProvider } = useContext(BookingContext);
  const { userInfo } = useContext(AuthContext);
  
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const serviceType = currentBooking?.serviceType || 'home';

  const normalizeServiceType = (type) => {
    if (!type) return null;
    const normalization = {
      'maison': 'home', 'bureau': 'office', 'immeuble': 'building', 'airbnb': 'airbnb',
      'home': 'home', 'office': 'office', 'building': 'building',
      'בית': 'home', 'משרד': 'office', 'בניין': 'building', 'אירבנב': 'airbnb',
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

  useEffect(() => { loadProviders(); }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredProviders(providers); return; }
    const q = searchQuery.toLowerCase();
    setFilteredProviders(
      providers.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
    );
  }, [searchQuery, providers]);

  const loadProviders = async () => {
    const clientCity = userInfo?.city ?? null;
    const sType      = currentBooking?.serviceType || 'home';

    console.log('═══════════ PROVIDER SEARCH DEBUG ═══════════');
    console.log('[1] userInfo :', JSON.stringify(userInfo, null, 2));
    console.log('[2] clientCity :', clientCity);
    console.log('[3] serviceType :', sType);
    if (!clientCity) console.warn('[!] clientCity est null — filtre ville non appliqué');

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
      navigation.navigate('ProviderProfileView', {
        provider,
        serviceType,
        serviceRate: getServiceSpecificRate(provider, serviceType),
      });
    } else {
      Alert.alert('שגיאת תצורה', 'פונקציית בחירת הספק אינה זמינה. אנא בדוק את BookingContext.', [{ text: 'אישור' }]);
    }
  };

  const getServiceLabel = (type) => {
    const labels = {
      home: 'ניקיון בית', office: 'ניקיון משרדים',
      building: 'ניקיון בניינים', airbnb: 'ניקיון אירבנב',
    };
    return labels[type] || type;
  };

  const getServiceSpecificRate = (provider, searchType) => {
    const normalizedSearchType = normalizeServiceType(searchType);
    if (provider.serviceDetails?.length > 0) {
      const service = provider.serviceDetails.find(s => normalizeServiceType(s.type) === normalizedSearchType);
      if (service?.hourlyRate) return service.hourlyRate;
    }
    if (provider.services?.length > 0) {
      const service = provider.services.find(s => normalizeServiceType(s.type) === normalizedSearchType);
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
    const langs = Array.isArray(item.languages) && item.languages.length > 0 ? item.languages : null;

    return (
      <TouchableOpacity
        style={styles.providerCard}
        onPress={() => handleSelectProvider(item)}
        activeOpacity={0.8}
      >
        <View style={styles.photo}>
          <PhotoOrPlaceholder uri={item.profilePicture} />
        </View>

        <View style={styles.providerInfo}>
          <View style={styles.nameRow}>
            <View style={styles.nameWrap}>
              <Text style={styles.providerName} numberOfLines={1}>
                {item.firstName} {item.lastName}
              </Text>
              {item.isVerified ? <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} /> : null}
            </View>
            <Text style={styles.price}>
              ₪{serviceRate}<Text style={styles.priceLabel}>/שעה</Text>
            </Text>
          </View>

          {item.rating ? (
            <View style={styles.metaRow}>
              <Ionicons name="star" size={13} color={COLORS.star} />
              <Text style={styles.metaText}>
                {item.rating}{item.reviewsCount ? ` (${item.reviewsCount})` : ''}
                {item.completedJobs ? ` · ${item.completedJobs} עבודות` : ''}
              </Text>
            </View>
          ) : null}

          {item.serviceAreas && item.serviceAreas.length > 0 && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {item.serviceAreas.slice(0, 2).join(', ')}
              </Text>
            </View>
          )}

          {item.bio ? (
            <Text style={styles.bioText} numberOfLines={2}>{item.bio}</Text>
          ) : null}

          <View style={styles.chipsRow}>
            {langs
              ? langs.map((l) => <Chip key={l} label={l} small />)
              : (item.serviceTypes || []).map((type, index) => (
                  <Chip key={index} label={translateServiceType(type)} small />
                ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>מחפש ספקים...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProviders}>
          <Text style={styles.retryButtonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const clientCity =
    userInfo?.city ||
    currentBooking?.address?.city ||
    currentBooking?.address?.fullAddress?.split(',')[1]?.trim();

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <ScreenHeader
          title={`${getServiceLabel(serviceType)}${clientCity ? ` · ${clientCity}` : ''}`}
          onBack={() => navigation.goBack()}
          style={styles.headerRow}
        />
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textHint} />
          <TextInput
            style={styles.searchInput}
            placeholder="חיפוש לפי שם..."
            placeholderTextColor={COLORS.textHint}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {filteredProviders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={48} color={COLORS.accent} />
          <Text style={styles.emptyText}>
            {clientCity ? `אין ספקים זמינים ב${clientCity}` : 'לא נמצאו ספקים'}
          </Text>
          <Text style={styles.emptySubtext}>
            {clientCity ? 'נסה לחפש בעיר סמוכה' : 'בדוק את העיר בפרופיל שלך'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProviders}
          renderItem={renderProviderCard}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.countText}>{filteredProviders.length} מנקים זמינים</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.canvas },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: COLORS.canvas },
  loadingText: { marginTop: 12, fontSize: 13, color: COLORS.textMuted },
  errorText: { marginTop: 12, fontSize: 13, color: COLORS.error, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 999, backgroundColor: COLORS.primary },
  retryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },

  headerArea: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  headerRow: { paddingTop: TOP_SPACE },
  searchContainer: {
    backgroundColor: COLORS.input,
    marginHorizontal: 18,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, textAlign: 'right', padding: 0 },

  listContainer: { padding: 18, paddingTop: 14, paddingBottom: 40, gap: 12 },
  countText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'right' },
  providerCard: {
    flexDirection: 'row-reverse',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photo: { width: 84, height: 96, borderRadius: 14, overflow: 'hidden' },
  providerInfo: { flex: 1, gap: 5 },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nameWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, flexShrink: 1 },
  providerName: { fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'right', flexShrink: 1 },
  price: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  priceLabel: { fontSize: 11, fontWeight: '400', color: COLORS.textMuted },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'right', flexShrink: 1 },
  bioText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'right', lineHeight: 17 },
  chipsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 2 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 14, fontWeight: '500', color: COLORS.text, textAlign: 'center', marginTop: 12, marginBottom: 4 },
  emptySubtext: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
});

export default ProviderSearch;
