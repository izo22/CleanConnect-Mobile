// src/components/PriceBreakdown.js
// ✅ גרסה מתורגמת לעברית עם תמיכה ב-RTL
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { calculatePlatformFees, PLATFORM_FEES } from '../config/constants';

const PriceBreakdown = ({ 
  servicePrice, 
  serviceType = 'home', // ✅ AJOUT du serviceType avec valeur par défaut
  serviceColor = '#2196F3', 
  showDetails = true,
  isPromo = false 
}) => {
  // ✅ Passer le serviceType à calculatePlatformFees
  const fees = calculatePlatformFees(servicePrice, isPromo, serviceType);
  const isRTL = true; // תמיד RTL לעברית
  
  const formatPrice = (price) => `${price.toFixed(2)} ${PLATFORM_FEES.CURRENCY}`;
  
  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={[styles.header, styles.rtlRow]}>
          <Ionicons name="cash-outline" size={24} color={serviceColor} style={styles.iconRTL} />
          <Text style={[styles.headerTitle, styles.textRTL]}>פירוט עמלות</Text>
        </View>
        
        {showDetails && (
          <>
            {/* מחיר השירות */}
            <View style={[styles.row, styles.rtlRow]}>
              <Text style={[styles.label, styles.textRTL]}>מחיר השירות</Text>
              <Text style={[styles.value, styles.textRTL]}>{formatPrice(fees.servicePrice)}</Text>
            </View>
            
            <View style={[styles.noteContainer, styles.rtlRow]}>
              <Ionicons name="information-circle-outline" size={16} color="#666" style={styles.iconRTL} />
              <Text style={[styles.noteText, styles.textRTL]}>
                לשלם ישירות לספק השירות (מזומן/העברה)
              </Text>
            </View>
            
            <Divider style={styles.divider} />
          </>
        )}
        
        {/* עמלות פלטפורמה */}
        <View style={styles.platformFeesSection}>
          <Text style={[styles.sectionTitle, styles.textRTL]}>עמלת הזמנה CleanConnect</Text>
          
          <View style={[styles.breakdownRow, styles.rtlRow]}>
            <Text style={[styles.breakdownLabel, styles.textRTL]}>• עמלת התחברות</Text>
            <Text style={[styles.breakdownValue, styles.textRTL]}>{formatPrice(fees.baseFee)}</Text>
          </View>
          
          <View style={[styles.breakdownRow, styles.rtlRow]}>
            <Text style={[styles.breakdownLabel, styles.textRTL]}>
              {/* ✅ Affichage dynamique du pourcentage */}
              • עמלת פלטפורמה ({fees.percentage}%)
            </Text>
            <Text style={[styles.breakdownValue, styles.textRTL]}>{formatPrice(fees.commission)}</Text>
          </View>
          
          <Divider style={styles.subtleDivider} />
          
          <View style={[styles.totalRow, styles.rtlRow]}>
            <Text style={[styles.totalLabel, styles.textRTL]}>סה״כ עמלות פלטפורמה</Text>
            <Text style={[styles.totalValue, styles.textRTL, { color: serviceColor }]}>
              {formatPrice(fees.platformFee)}
            </Text>
          </View>
          
          {isPromo && (
            <View style={[styles.promoContainer, styles.rtlRow]}>
              <Ionicons name="gift" size={16} color="#4CAF50" style={styles.iconRTL} />
              <Text style={[styles.promoText, styles.textRTL]}>מחיר מבצע השקה!</Text>
            </View>
          )}
        </View>
        
        <View style={styles.benefitsContainer}>
          <Text style={[styles.benefitsTitle, styles.textRTL]}>מה כוללות העמלות:</Text>
          <View style={[styles.benefitRow, styles.rtlRow]}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={styles.iconRTL} />
            <Text style={[styles.benefitText, styles.textRTL]}>פתיחת קשר עם ספק השירות</Text>
          </View>
          <View style={[styles.benefitRow, styles.rtlRow]}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={styles.iconRTL} />
            <Text style={[styles.benefitText, styles.textRTL]}>אישור הזמנה</Text>
          </View>
          <View style={[styles.benefitRow, styles.rtlRow]}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={styles.iconRTL} />
            <Text style={[styles.benefitText, styles.textRTL]}>תמיכת לקוחות</Text>
          </View>
          <View style={[styles.benefitRow, styles.rtlRow]}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={styles.iconRTL} />
            <Text style={[styles.benefitText, styles.textRTL]}>טיפול בתלונות</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    elevation: 4,
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
    color: '#333',
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  noteContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#856404',
    marginRight: 8,
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 15,
  },
  subtleDivider: {
    height: 1,
    marginVertical: 10,
    backgroundColor: '#E0E0E0',
  },
  platformFeesSection: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingRight: 10,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  breakdownValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingTop: 15,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  promoContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  promoText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: 'bold',
    marginRight: 6,
  },
  benefitsContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 8,
  },
  benefitRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 6,
  },
  benefitText: {
    fontSize: 13,
    color: '#1976D2',
    marginRight: 8,
  },
  // ✅ Styles RTL
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  iconRTL: {
    marginLeft: 8,
    marginRight: 0,
  },
});

export default PriceBreakdown;