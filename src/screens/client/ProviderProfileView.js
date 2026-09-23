// src/screens/client/ProviderProfileView.js
// ✅ NOUVEAU (maquette 03 · Profil prestataire, côté client)
// Recherche → Profil → ScheduleScreen. Les éléments sans donnée backend
// (note, nombre de missions, langues, expérience) ne s'affichent pas.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../config/theme';
import { SERVICE_TYPE_LABELS } from '../../config/constants';
import { useBooking } from '../../context/BookingContext';
import { PhotoOrPlaceholder, Chip, SectionTitle, PrimaryButton, TOP_SPACE } from '../../components/BlueUI';

const HEBREW_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const toYMD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Même règle que ScheduleScreen.hasAvailability
const isAvailableOn = (availability, date) => {
  const ymd = toYMD(date);
  return availability.some((av) =>
    av.status === 'available' &&
    (av.isRecurring ? av.dayOfWeek === date.getDay() : av.date === ymd)
  );
};

const normalizeType = (type) => {
  const map = { maison: 'home', bureau: 'office', immeuble: 'building', 'בית': 'home', 'משרד': 'office', 'בניין': 'building', 'אירבנב': 'airbnb' };
  if (!type) return null;
  return map[type] || type.toLowerCase();
};

const getRate = (provider, serviceType) => {
  const t = normalizeType(serviceType);
  const lists = [provider.serviceDetails, provider.services].filter(Array.isArray);
  for (const list of lists) {
    const s = list.find((x) => normalizeType(x.type) === t);
    if (s?.hourlyRate) return s.hourlyRate;
  }
  if (provider.price && typeof provider.price === 'object' && provider.price[t]) return provider.price[t];
  return provider.hourlyRate || 0;
};

const ProviderProfileView = ({ route, navigation }) => {
  const { currentBooking, selectProvider } = useBooking();
  const { provider = {}, serviceType: paramType, serviceRate } = route?.params || {};
  const serviceType = paramType || currentBooking?.serviceType || 'home';
  const rate = serviceRate ?? getRate(provider, serviceType);
  const fullName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || provider.name;

  // 5 prochains jours disponibles (sur 21 jours)
  const nextDays = useMemo(() => {
    const availability = Array.isArray(provider.availability) ? provider.availability : [];
    if (!availability.length) return [];
    const days = [];
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    for (let i = 0; i < 21 && days.length < 5; i++) {
      if (isAvailableOn(availability, d)) days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [provider.availability]);

  const [selectedDay, setSelectedDay] = useState(0);

  const goToSchedule = (withDate) => {
    selectProvider(provider);
    navigation.navigate('ScheduleScreen', {
      providerId:   provider._id,
      providerName: fullName,
      hourlyRate:   provider.hourlyRate,
      initialDate:  withDate && nextDays[selectedDay] ? toYMD(nextDays[selectedDay]) : undefined,
    });
  };

  const langs = Array.isArray(provider.languages) ? provider.languages : [];
  const chips = langs.length
    ? langs
    : (provider.serviceTypes || []).map((t) => SERVICE_TYPE_LABELS[normalizeType(t)] || t);

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* PHOTO */}
        <View style={styles.hero}>
          <PhotoOrPlaceholder uri={provider.profilePicture} iconSize={96} />
          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.roundButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* FICHE */}
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <View style={styles.nameWrap}>
              <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
              {provider.isVerified ? <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} /> : null}
            </View>
            <Text style={styles.price}>₪{rate}<Text style={styles.priceUnit}>/שעה</Text></Text>
          </View>

          <View style={styles.metaWrap}>
            {provider.rating ? (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={14} color={COLORS.star} />
                <Text style={styles.metaText}>
                  {provider.rating}{provider.reviewsCount ? ` (${provider.reviewsCount} ביקורות)` : ''}
                </Text>
              </View>
            ) : null}
            {provider.completedJobs ? (
              <Text style={styles.metaText}>{provider.completedJobs} עבודות שהושלמו</Text>
            ) : null}
            {provider.serviceAreas?.length ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{provider.serviceAreas.slice(0, 3).join(', ')}</Text>
              </View>
            ) : null}
            {provider.yearsOfExperience ? (
              <View style={styles.metaItem}>
                <Ionicons name="briefcase-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{provider.yearsOfExperience}+ שנות ניסיון</Text>
              </View>
            ) : null}
          </View>

          {provider.bio ? <Text style={styles.bio}>{provider.bio}</Text> : null}

          {chips.length > 0 && (
            <View style={styles.chips}>
              {chips.map((c, i) => <Chip key={`${c}-${i}`} label={c} />)}
            </View>
          )}

          {nextDays.length > 0 && (
            <>
              <View style={styles.availabilityTitle}>
                <SectionTitle title="זמינות" linkLabel="ליומן המלא" onLinkPress={() => goToSchedule(false)} />
              </View>
              <View style={styles.daysRow}>
                {nextDays.map((d, i) => {
                  const active = i === selectedDay;
                  return (
                    <TouchableOpacity
                      key={toYMD(d)}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      onPress={() => setSelectedDay(i)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dayName, active && styles.dayTextActive]}>{HEBREW_DAY_NAMES[d.getDay()]}</Text>
                      <Text style={[styles.dayDate, active && styles.dayTextActive]}>{d.getDate()}/{d.getMonth() + 1}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="הזמינו עכשיו" icon={null} onPress={() => goToSchedule(true)} />
        <View style={styles.secureRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.secureText}>הזמנה ותשלום מאובטחים</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  hero: { height: 330, backgroundColor: COLORS.tint },
  heroButtons: { position: 'absolute', top: TOP_SPACE + 4, right: 16, left: 16, flexDirection: 'row-reverse' },
  roundButton: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },

  sheet: {
    marginTop: -22,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nameWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontSize: 24, fontWeight: '700', color: COLORS.text, textAlign: 'right', flexShrink: 1 },
  price: { fontSize: 22, fontWeight: '700', color: COLORS.navy },
  priceUnit: { fontSize: 13, fontWeight: '400', color: COLORS.textMuted },

  metaWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  metaItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'right' },

  bio: { fontSize: 14, lineHeight: 22, color: COLORS.textBody, textAlign: 'right', writingDirection: 'rtl' },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },

  availabilityTitle: { marginTop: 4 },
  daysRow: { flexDirection: 'row-reverse', gap: 6 },
  dayChip: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.chipBorder, backgroundColor: COLORS.surface,
  },
  dayChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  dayDate: { fontSize: 11, color: COLORS.text },
  dayTextActive: { color: COLORS.white },

  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 8, backgroundColor: COLORS.surface },
  secureRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  secureText: { fontSize: 12, color: COLORS.textMuted },
});

export default ProviderProfileView;
