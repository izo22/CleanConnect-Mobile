// src/components/PriceBreakdown.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { calculatePlatformFees, PLATFORM_FEES } from '../config/constants';

const PriceBreakdown = ({ 
  servicePrice, 
  serviceColor = '#2196F3', 
  showDetails = true,
  isPromo = false 
}) => {
  const fees = calculatePlatformFees(servicePrice, isPromo);
  
  const formatPrice = (price) => `${price.toFixed(2)} ${PLATFORM_FEES.CURRENCY}`;
  
  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Ionicons name="cash-outline" size={24} color={serviceColor} />
          <Text style={styles.headerTitle}>Détail des frais</Text>
        </View>
        
        {showDetails && (
          <>
            {/* Prix du service */}
            <View style={styles.row}>
              <Text style={styles.label}>Prix du service</Text>
              <Text style={styles.value}>{formatPrice(fees.servicePrice)}</Text>
            </View>
            
            <View style={styles.noteContainer}>
              <Ionicons name="information-circle-outline" size={16} color="#666" />
              <Text style={styles.noteText}>
                À payer directement au prestataire (cash/virement)
              </Text>
            </View>
            
            <Divider style={styles.divider} />
          </>
        )}
        
        {/* Frais plateforme */}
        <View style={styles.platformFeesSection}>
          <Text style={styles.sectionTitle}>Frais de réservation CleanConnect</Text>
          
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>• Frais de mise en relation</Text>
            <Text style={styles.breakdownValue}>{formatPrice(fees.baseFee)}</Text>
          </View>
          
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>• Commission plateforme (3%)</Text>
            <Text style={styles.breakdownValue}>{formatPrice(fees.commission)}</Text>
          </View>
          
          <Divider style={styles.subtleDivider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total frais plateforme</Text>
            <Text style={[styles.totalValue, { color: serviceColor }]}>
              {formatPrice(fees.platformFee)}
            </Text>
          </View>
          
          {isPromo && (
            <View style={styles.promoContainer}>
              <Ionicons name="gift" size={16} color="#4CAF50" />
              <Text style={styles.promoText}>Prix promo lancement !</Text>
            </View>
          )}
        </View>
        
        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Ce que comprennent les frais :</Text>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.benefitText}>Déblocage du contact prestataire</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.benefitText}>Confirmation de réservation</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.benefitText}>Support client</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.benefitText}>Gestion des litiges</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#856404',
    marginLeft: 8,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingLeft: 10,
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    marginLeft: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  benefitText: {
    fontSize: 13,
    color: '#1976D2',
    marginLeft: 8,
  },
});

export default PriceBreakdown;
