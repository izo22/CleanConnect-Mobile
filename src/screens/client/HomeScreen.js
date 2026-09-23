// src/screens/client/HomeScreen.js
// ✅ REFONTE BLEU CLAIR (maquette 01 · Accueil)
// Marque + ville · recherche · bannière · catégories · meilleurs prestataires

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SERVICE_TYPES } from '../../config/constants';
import { COLORS } from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import providerService from '../../services/providerService';
import { PhotoOrPlaceholder, SectionTitle, Chip, TOP_SPACE } from '../../components/BlueUI';

const CATEGORIES = [
  { type: SERVICE_TYPES.HOME,     label: 'בית',    icon: 'home-outline' },
  { type: SERVICE_TYPES.OFFICE,   label: 'משרד',   icon: 'briefcase-outline' },
  { type: SERVICE_TYPES.BUILDING, label: 'בניין',  icon: 'business-outline' },
  { type: SERVICE_TYPES.AIRBNB,   label: 'Airbnb', icon: 'key-outline' },
];

const HomeScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const { updateBooking, selectProvider } = useBooking();
  const [selectedType, setSelectedType] = useState(SERVICE_TYPES.HOME);
  const [topProviders, setTopProviders] = useState([]);
  const carouselRef = useRef(null);

  const city = userInfo?.city;

  // Meilleurs prestataires de la catégorie sélectionnée (section masquée si aucun résultat)
  useEffect(() => {
    let cancelled = false;
    providerService.getAllProviders(city ?? null, selectedType)
      .then((list) => { if (!cancelled) setTopProviders(Array.isArray(list) ? list.slice(0, 6) : []); })
      .catch(() => { if (!cancelled) setTopProviders([]); });
    return () => { cancelled = true; };
  }, [city, selectedType]);

  const startBooking = useCallback((serviceType) => {
    updateBooking({
      serviceType,
      duration: 2,
      frequency: 'one_time'
    });
  }, [updateBooking]);

  const navigateToService = (serviceType) => {
    setSelectedType(serviceType);
    startBooking(serviceType);
    navigation.navigate('ProviderSearch', {
      serviceType,
      duration: '2',
      frequency: 'once'
    });
  };

  const openProvider = (provider) => {
    startBooking(selectedType);
    selectProvider(provider);
    navigation.navigate('ProviderProfileView', { provider, serviceType: selectedType });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* MARQUE + VILLE */}
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Ionicons name="home-outline" size={30} color={COLORS.primary} />
            <View>
              <Text style={styles.brandName}>CleanConnect</Text>
              <Text style={styles.brandTagline}>אנשים אמינים. בתים נוצצים.</Text>
            </View>
          </View>
          {city ? (
            <TouchableOpacity style={styles.cityPill} onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
              <Ionicons name="location-outline" size={16} color={COLORS.primary} />
              <Text style={styles.cityText}>{city}</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.navy} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* RECHERCHE */}
        <View style={styles.searchRow}>
          <TouchableOpacity style={styles.searchBar} onPress={() => navigateToService(selectedType)} activeOpacity={0.8}>
            <Ionicons name="search" size={18} color={COLORS.textHint} />
            <Text style={styles.searchPlaceholder}>מה תרצו לנקות?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={() => navigateToService(selectedType)}>
            <Ionicons name="options-outline" size={22} color={COLORS.navy} />
          </TouchableOpacity>
        </View>

        {/* BANNIÈRE */}
        <View style={styles.hero}>
          <Ionicons name="sparkles" size={150} color="rgba(255,255,255,0.22)" style={styles.heroArt} />
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{'בית נקי יותר,\nימים שמחים יותר'}</Text>
            <Text style={styles.heroSubtitle}>{city ? `מנקים אמינים ב${city}` : 'מנקים אמינים באזור שלך'}</Text>
            <TouchableOpacity style={styles.heroButton} onPress={() => navigateToService(selectedType)} activeOpacity={0.85}>
              <Text style={styles.heroButtonText}>הזמינו מנקה</Text>
              <Ionicons name="arrow-back" size={14} color={COLORS.navy} />
            </TouchableOpacity>
          </View>
        </View>

        {/* CATÉGORIES */}
        <View style={styles.categories}>
          {CATEGORIES.map((c) => {
            const active = c.type === selectedType;
            return (
              <TouchableOpacity
                key={c.type}
                style={[styles.category, active && styles.categoryActive]}
                onPress={() => navigateToService(c.type)}
                activeOpacity={0.8}
              >
                <Ionicons name={c.icon} size={22} color={active ? COLORS.primaryDark : COLORS.textMuted} />
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* MEILLEURS PRESTATAIRES */}
        {topProviders.length > 0 && (
          <>
            <SectionTitle title="המנקים המובילים" size={19} linkLabel="הצג הכל" onLinkPress={() => navigateToService(selectedType)} />
            <ScrollView
              ref={carouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}
              // RTL : la première carte est à droite → on démarre en fin de défilement
              onContentSizeChange={() => carouselRef.current?.scrollToEnd({ animated: false })}
            >
              {topProviders.map((p) => (
                <TouchableOpacity key={p._id || p.id} style={styles.providerCard} onPress={() => openProvider(p)} activeOpacity={0.85}>
                  <View style={styles.providerPhoto}>
                    <PhotoOrPlaceholder uri={p.profilePicture} />
                  </View>
                  <View style={styles.providerBody}>
                    <Text style={styles.providerName} numberOfLines={1}>{p.firstName} {p.lastName}</Text>
                    {p.rating ? (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={13} color={COLORS.star} />
                        <Text style={styles.ratingText}>
                          {p.rating}{p.reviewsCount ? ` (${p.reviewsCount})` : ''}
                        </Text>
                      </View>
                    ) : null}
                    {Array.isArray(p.languages) && p.languages.length > 0 ? (
                      <View style={styles.langs}>
                        {p.languages.slice(0, 3).map((l) => <Chip key={l} label={l} small />)}
                      </View>
                    ) : p.serviceAreas?.length ? (
                      <Text style={styles.areaText} numberOfLines={1}>{p.serviceAreas.slice(0, 2).join(', ')}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingHorizontal: 18, paddingTop: TOP_SPACE, paddingBottom: 28, gap: 16 },

  topRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 21, fontWeight: '700', color: COLORS.navy, textAlign: 'right' },
  brandTagline: { fontSize: 10, color: COLORS.textMuted, textAlign: 'right' },
  cityPill: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.tint, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12,
  },
  cityText: { fontSize: 14, fontWeight: '500', color: COLORS.navy },

  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  searchBar: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.input, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16,
  },
  searchPlaceholder: { fontSize: 14, color: COLORS.textHint, textAlign: 'right' },
  filterButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  hero: { height: 210, borderRadius: 22, overflow: 'hidden', backgroundColor: COLORS.accent },
  heroArt: { position: 'absolute', top: 10, left: 14 },
  // Voile uniforme (pas de LinearGradient : crash APK release)
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,40,62,0.28)' },
  heroContent: { position: 'absolute', right: 18, left: 18, bottom: 18, alignItems: 'flex-end', gap: 6 },
  heroTitle: { fontSize: 23, fontWeight: '700', color: COLORS.white, lineHeight: 27, textAlign: 'right' },
  heroSubtitle: { fontSize: 13, color: COLORS.white, textAlign: 'right' },
  heroButton: {
    marginTop: 6, flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.white, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14,
  },
  heroButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.navy },

  categories: { flexDirection: 'row-reverse', gap: 8 },
  category: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4,
    borderRadius: 18, backgroundColor: COLORS.input,
  },
  categoryActive: { backgroundColor: COLORS.tintStrong },
  categoryLabel: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted },
  categoryLabelActive: { color: COLORS.primaryDark },

  carousel: { marginHorizontal: -18 },
  carouselContent: { flexDirection: 'row-reverse', gap: 12, paddingHorizontal: 18 },
  providerCard: {
    width: 150, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18,
    overflow: 'hidden', backgroundColor: COLORS.surface,
  },
  providerPhoto: { height: 120 },
  providerBody: { padding: 10, gap: 6 },
  providerName: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, color: COLORS.textMuted },
  langs: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 },
  areaText: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right' },
});

export default HomeScreen;
