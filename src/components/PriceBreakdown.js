// src/components/PriceBreakdown.js
// ✅ גרסה מתורגמת לעברית עם תמיכה ב-RTL
// ✅ REFONTE BLEU CLAIR (maquette 05) : carte blanche bordée, total en bleu nuit
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { calculatePlatformFees, PLATFORM_FEES } from '../config/constants';
import { COLORS } from '../config/theme';

const PriceBreakdown = ({
  servicePrice,
  serviceType = 'home', // ✅ AJOUT du serviceType avec valeur par défaut
  serviceColor = COLORS.navy,
  showDetails = true,
  isPromo = false
}) => {
  // ✅ Passer le serviceType à calculatePlatformFees
  const fees = calculatePlatformFees(servicePrice, isPromo, serviceType);

  const formatPrice = (price) => `${price.toFixed(2)} ${PLATFORM_FEES.CURRENCY}`;

  return (
    <View style={styles.card}>
      {showDetails && (
        <>
          {/* מחיר השירות */}
          <View style={styles.row}>
            <Text style={[styles.label, styles.textRTL]}>מחיר השירות</Text>
            <Text style={styles.value}>{formatPrice(fees.servicePrice)}</Text>
          </View>

          <View style={styles.noteContainer}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
            <Text style={[styles.noteText, styles.textRTL]}>
              לשלם ישירות לספק השירות (מזומן/העברה)
            </Text>
          </View>

          <View style={styles.divider} />
        </>
      )}

      {/* עמלות פלטפורמה */}
      <Text style={[styles.sectionTitle, styles.textRTL]}>עמלת הזמנה CleanConnect</Text>

      <View style={styles.row}>
        <Text style={[styles.label, styles.textRTL]}>עמלת התחברות</Text>
        <Text style={styles.value}>{formatPrice(fees.baseFee)}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.labelWithIcon}>
          {/* ✅ Affichage dynamique du pourcentage */}
          <Text style={[styles.label, styles.textRTL]}>עמלת פלטפורמה ({fees.percentage}%)</Text>
          <Ionicons name="information-circle-outline" size={13} color={COLORS.textBody} />
        </View>
        <Text style={styles.value}>{formatPrice(fees.commission)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={[styles.totalLabel, styles.textRTL]}>סה״כ עמלות פלטפורמה</Text>
        <Text style={[styles.totalValue, { color: serviceColor }]}>
          {formatPrice(fees.platformFee)}
        </Text>
      </View>

      {isPromo && (
        <View style={styles.promoContainer}>
          <Ionicons name="gift-outline" size={16} color={COLORS.primary} />
          <Text style={[styles.promoText, styles.textRTL]}>מחיר מבצע השקה!</Text>
        </View>
      )}

      <View style={styles.benefitsContainer}>
        <Text style={[styles.benefitsTitle, styles.textRTL]}>מה כוללות העמלות:</Text>
        {['פתיחת קשר עם ספק השירות', 'אישור הזמנה', 'תמיכת לקוחות', 'טיפול בתלונות'].map((b) => (
          <View key={b} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={15} color={COLORS.primary} />
            <Text style={[styles.benefitText, styles.textRTL]}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelWithIcon: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  label: {
    fontSize: 14,
    color: COLORS.textBody,
    flexShrink: 1,
  },
  value: {
    fontSize: 14,
    color: COLORS.textBody,
  },
  noteContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.tint,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  noteText: {
    fontSize: 12,
    color: COLORS.navy,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  promoContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.tint,
    padding: 8,
    borderRadius: 12,
  },
  promoText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  benefitsContainer: {
    backgroundColor: COLORS.canvas,
    padding: 12,
    borderRadius: 14,
    gap: 6,
    marginTop: 4,
  },
  benefitsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navy,
  },
  benefitRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  benefitText: {
    fontSize: 13,
    color: COLORS.textBody,
  },
  // ✅ Styles RTL
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default PriceBreakdown;
