// src/components/BlueUI.js
// Briques visuelles partagées de la refonte « bleu clair » (maquettes Claude Design).

import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';

// Espace sous la barre d'état (même approche que les écrans existants : padding fixe)
export const TOP_SPACE = 52;

// Bouton principal pleine largeur, en pilule
export const PrimaryButton = ({ title, onPress, icon = 'arrow-back', disabled, loading, style }) => (
  <TouchableOpacity
    style={[styles.primaryButton, (disabled || loading) && styles.primaryButtonDisabled, style]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.85}
  >
    {loading ? (
      <ActivityIndicator color={COLORS.white} />
    ) : (
      <>
        <Text style={styles.primaryButtonText}>{title}</Text>
        {icon ? <Ionicons name={icon} size={18} color={COLORS.white} /> : null}
      </>
    )}
  </TouchableOpacity>
);

// Petite pastille (langues, filtres…)
export const Chip = ({ label, active, onPress, icon, small }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, small && styles.chipSmall, active && styles.chipActive]}
    >
      {icon ? <Ionicons name={icon} size={small ? 12 : 14} color={active ? COLORS.white : COLORS.navy} /> : null}
      <Text style={[styles.chipText, small && styles.chipTextSmall, active && styles.chipTextActive]}>{label}</Text>
    </Wrapper>
  );
};

// En-tête d'écran : retour (à droite en RTL) · titre centré · action optionnelle
export const ScreenHeader = ({ title, subtitle, onBack, right, style }) => (
  <View style={[styles.header, style]}>
    <TouchableOpacity onPress={onBack} style={styles.headerSide} disabled={!onBack} hitSlop={10}>
      {onBack ? <Ionicons name="chevron-forward" size={24} color={COLORS.text} /> : null}
    </TouchableOpacity>
    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
    <View style={[styles.headerSide, styles.headerSideEnd]}>{right}</View>
  </View>
);

// Photo, ou fond bleu avec icône quand aucune image n'est disponible
export const PhotoOrPlaceholder = ({ uri, style, icon = 'person', iconSize = 32, rounded }) => (
  uri ? (
    <Image source={{ uri }} style={[styles.fill, style, rounded && { borderRadius: 999 }]} resizeMode="cover" />
  ) : (
    <View style={[styles.fill, styles.placeholder, style, rounded && { borderRadius: 999 }]}>
      <Ionicons name={icon} size={iconSize} color={COLORS.accent} />
    </View>
  )
);

// Titre de section avec lien « voir tout » optionnel
export const SectionTitle = ({ title, linkLabel, onLinkPress, size = 17 }) => (
  <View style={styles.sectionRow}>
    <Text style={[styles.sectionTitle, { fontSize: size }]}>{title}</Text>
    {linkLabel ? (
      <TouchableOpacity style={styles.sectionLink} onPress={onLinkPress}>
        <Text style={styles.sectionLinkText}>{linkLabel}</Text>
        <Ionicons name="chevron-back" size={14} color={COLORS.primary} />
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  primaryButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 15,
    minHeight: 54,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: COLORS.white, fontSize: 17, fontWeight: '600' },

  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.tint,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipSmall: { paddingHorizontal: 8, paddingVertical: 2 },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.navy },
  chipTextSmall: { fontSize: 11 },
  chipTextActive: { color: COLORS.white, fontWeight: '500' },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
  },
  headerSide: { width: 32, alignItems: 'flex-end' },
  headerSideEnd: { alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  headerSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  fill: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: COLORS.tint, alignItems: 'center', justifyContent: 'center' },

  sectionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontWeight: '700', color: COLORS.text, textAlign: 'right' },
  sectionLink: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2 },
  sectionLinkText: { fontSize: 13, color: COLORS.primary },
});
