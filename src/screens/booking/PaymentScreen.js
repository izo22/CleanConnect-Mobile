// src/screens/booking/PaymentScreen.js
// ✅ NOUVEAU SYSTÈME SIMPLE - Paiement uniquement des frais plateforme (10₪ + 3%)

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Title, TextInput, Button, RadioButton, Divider, ActivityIndicator, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, calculatePlatformFees, PLATFORM_FEES } from '../../config/constants';
import PriceBreakdown from '../../components/PriceBreakdown';

// Service de paiement simple - Uniquement pour les frais plateforme
const PaymentService = {
  validateCardNumber: (cardNumber) => {
    const cleaned = cardNumber.replace(/\s+/g, '');
    return /^\d{13,19}$/.test(cleaned) && cleaned.length >= 13;
  },

  getCardType: (cardNumber) => {
    const cleaned = cardNumber.replace(/\s+/g, '');
    
    if (/^4/.test(cleaned)) return { type: 'visa', name: 'Visa' };
    if (/^5[1-5]/.test(cleaned)) return { type: 'mastercard', name: 'MasterCard' };
    if (/^3[47]/.test(cleaned)) return { type: 'amex', name: 'American Express' };
    
    return { type: 'unknown', name: 'Carte inconnue' };
  },

  // Paiement simple des frais plateforme
  processPayment: async (cardInfo, amount) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simuler un échec aléatoire (10% de chance)
    const random = Math.random();
    if (random < 0.10) {
      throw new Error('Paiement refusé. Vérifiez vos informations bancaires.');
    }
    
    return {
      success: true,
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: amount,
      last4: cardInfo.cardNumber.slice(-4),
      timestamp: new Date().toISOString()
    };
  }
};

const PaymentScreen = ({ navigation }) => {
  const theme = useTheme();
  const { currentBooking, createBooking } = useBooking();
  
  // États de paiement
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  
  // États des champs de carte
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');
  const [cardType, setCardType] = useState({ type: 'unknown', name: '' });
  
  // États de validation
  const [cardErrors, setCardErrors] = useState({});

  useEffect(() => {
    if (cardNumber.length > 4) {
      setCardType(PaymentService.getCardType(cardNumber));
    } else {
      setCardType({ type: 'unknown', name: '' });
    }
  }, [cardNumber]);

  const getServiceColor = () => {
    switch (currentBooking.serviceType) {
      case 'home': return '#4CAF50';
      case 'office': return '#2196F3';
      case 'building': return '#FF9800';
      default: return '#6200ee';
    }
  };
  
  const serviceColor = getServiceColor();

  // Calcul des frais plateforme
  const platformFees = calculatePlatformFees(currentBooking.price, false);

  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const parts = [];
    
    for (let i = 0; i < cleaned.length; i += 4) {
      parts.push(cleaned.substring(i, i + 4));
    }
    
    return parts.join(' ');
  };

  const handleCardNumberChange = (text) => {
    const formatted = formatCardNumber(text);
    setCardNumber(formatted);
    
    const errors = { ...cardErrors };
    if (text.length > 0 && !PaymentService.validateCardNumber(formatted)) {
      errors.cardNumber = 'Numéro de carte invalide';
    } else {
      delete errors.cardNumber;
    }
    setCardErrors(errors);
  };

  const formatExpiryDate = (text) => {
    const cleaned = text.replace(/[^\d]/g, '');
    
    if (cleaned.length <= 2) {
      return cleaned;
    } else {
      const month = cleaned.substring(0, 2);
      const year = cleaned.substring(2, 4);
      
      if (parseInt(month) > 12) return '12/' + year;
      return `${month}/${year}`;
    }
  };

  const handleExpiryDateChange = (text) => {
    const formatted = formatExpiryDate(text);
    setExpiryDate(formatted);
    
    const errors = { ...cardErrors };
    if (formatted.length === 5) {
      const [month, year] = formatted.split('/');
      const expiry = new Date(`20${year}`, month - 1);
      
      if (expiry <= new Date()) {
        errors.expiryDate = 'La carte a expiré';
      } else {
        delete errors.expiryDate;
      }
    }
    setCardErrors(errors);
  };

  const handleCvvChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCvv(cleaned);
    
    const errors = { ...cardErrors };
    const expectedLength = cardType.type === 'amex' ? 4 : 3;
    
    if (cleaned.length > 0 && cleaned.length !== expectedLength) {
      errors.cvv = `Le CVV doit contenir ${expectedLength} chiffres`;
    } else {
      delete errors.cvv;
    }
    setCardErrors(errors);
  };

  const validatePaymentFields = () => {
    const errors = {};
    
    if (paymentMethod === 'card') {
      if (!cardNumber || !PaymentService.validateCardNumber(cardNumber)) {
        errors.cardNumber = 'Numéro de carte invalide';
      }
      
      if (!expiryDate || expiryDate.length < 5) {
        errors.expiryDate = 'Date d\'expiration invalide';
      }
      
      const expectedCvvLength = cardType.type === 'amex' ? 4 : 3;
      if (!cvv || cvv.length !== expectedCvvLength) {
        errors.cvv = `Le CVV doit contenir ${expectedCvvLength} chiffres`;
      }
      
      if (!nameOnCard || nameOnCard.length < 2) {
        errors.nameOnCard = 'Nom sur la carte requis';
      }
    }
    
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ✅ FONCTION PRINCIPALE - Paiement simple des frais plateforme
  const handleConfirmReservation = async () => {
    if (paymentMethod === 'card' && !validatePaymentFields()) {
      Alert.alert('Erreur', 'Veuillez corriger les erreurs avant de continuer');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      let paymentResult = null;
      
      if (paymentMethod === 'card') {
        // Paiement des frais plateforme par carte
        setProcessingStep('Traitement du paiement...');
        
        const cardInfo = {
          cardNumber: cardNumber,
          expiryDate: expiryDate,
          cvv: cvv,
          nameOnCard: nameOnCard
        };
        
        paymentResult = await PaymentService.processPayment(
          cardInfo, 
          platformFees.platformFee
        );
        
        setProcessingStep('Paiement confirmé...');
      }
      
      // Création de la réservation
      setProcessingStep('Création de votre réservation...');
      
      const bookingResult = await createBooking();
      
      if (bookingResult.success) {
        // Navigation vers confirmation
        navigation.reset({
          index: 0,
          routes: [{ 
            name: 'BookingConfirmation', 
            params: { 
              bookingId: bookingResult.booking._id,
              paymentMethod: paymentMethod,
              platformFee: platformFees.platformFee,
              transactionId: paymentResult?.transactionId
            } 
          }],
        });
      } else {
        throw new Error(bookingResult.message || 'Erreur lors de la création de la réservation');
      }
      
    } catch (error) {
      console.error('Erreur lors de la réservation:', error);
      
      Alert.alert('Erreur', error.message, [
        { text: 'OK', onPress: () => setIsProcessing(false) }
      ]);
      
    } finally {
      setProcessingStep('');
    }
  };

  const formatPrice = (price) => `${price.toFixed(2)} ${PLATFORM_FEES.CURRENCY}`;
  
  const getCardIcon = () => {
    switch (cardType.type) {
      case 'visa': return 'card';
      case 'mastercard': return 'card';
      case 'amex': return 'card';
      default: return 'card-outline';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: serviceColor }]}>
        <Title style={styles.headerTitle}>Paiement sécurisé</Title>
        <Text style={styles.headerSubtitle}>
          {SERVICE_TYPE_LABELS[currentBooking.serviceType]}
        </Text>
        <Text style={styles.platformFeeAmount}>
          Frais de réservation : {formatPrice(platformFees.platformFee)}
        </Text>
        
        <View style={styles.securityBadge}>
          <Ionicons name="shield-checkmark" size={16} color="white" />
          <Text style={styles.securityText}>Paiement 100% sécurisé</Text>
        </View>
      </View>

      {/* Explication du modèle */}
      <Card style={styles.explanationCard}>
        <Card.Content>
          <View style={styles.explanationHeader}>
            <Ionicons name="information-circle" size={24} color={serviceColor} />
            <Text style={styles.explanationTitle}>Comment ça marche ?</Text>
          </View>
          
          <View style={styles.explanationSteps}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                Vous payez {formatPrice(platformFees.platformFee)} de frais de réservation
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                Vous recevez les coordonnées du prestataire
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Vous payez le service ({formatPrice(currentBooking.price)}) DIRECTEMENT au prestataire
              </Text>
            </View>
          </View>

          <View style={styles.benefitsBox}>
            <Text style={styles.benefitsTitle}>✓ Ce que comprennent les frais :</Text>
            <Text style={styles.benefitText}>• Déblocage du contact</Text>
            <Text style={styles.benefitText}>• Confirmation de réservation</Text>
            <Text style={styles.benefitText}>• Support client</Text>
            <Text style={styles.benefitText}>• Garantie plateforme</Text>
          </View>
        </Card.Content>
      </Card>
      
      {/* Récapitulatif des prix */}
      <View style={styles.priceBreakdownContainer}>
        <PriceBreakdown 
          servicePrice={currentBooking.price}
          serviceColor={serviceColor}
          showDetails={true}
          isPromo={false}
        />
      </View>
      
      {/* Méthodes de paiement */}
      <Card style={styles.paymentMethodCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Méthode de paiement des frais</Title>
          
          <RadioButton.Group onValueChange={setPaymentMethod} value={paymentMethod}>
            <View style={styles.radioOption}>
              <RadioButton value="card" color={serviceColor} />
              <View style={styles.radioContent}>
                <Text style={styles.radioLabel}>Carte bancaire</Text>
                <Text style={styles.radioDescription}>Paiement immédiat sécurisé</Text>
              </View>
            </View>
          </RadioButton.Group>
        </Card.Content>
      </Card>

      {/* Détails de carte */}
      {paymentMethod === 'card' && (
        <Card style={styles.cardDetailsCard}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Title style={styles.sectionTitle}>Informations de paiement</Title>
              {cardType.name && (
                <View style={styles.cardTypeIndicator}>
                  <Ionicons name={getCardIcon()} size={20} color={serviceColor} />
                  <Text style={styles.cardTypeName}>{cardType.name}</Text>
                </View>
              )}
            </View>
            
            <TextInput
              label="Numéro de carte"
              value={cardNumber}
              onChangeText={handleCardNumberChange}
              style={styles.input}
              keyboardType="numeric"
              maxLength={23}
              error={!!cardErrors.cardNumber}
              theme={{ colors: { primary: serviceColor } }}
            />
            {cardErrors.cardNumber && (
              <Text style={styles.errorText}>{cardErrors.cardNumber}</Text>
            )}
            
            <View style={styles.rowInputs}>
              <View style={styles.halfInputContainer}>
                <TextInput
                  label="MM/YY"
                  value={expiryDate}
                  onChangeText={handleExpiryDateChange}
                  style={[styles.input, styles.halfInput]}
                  keyboardType="numeric"
                  maxLength={5}
                  error={!!cardErrors.expiryDate}
                  theme={{ colors: { primary: serviceColor } }}
                />
                {cardErrors.expiryDate && (
                  <Text style={styles.errorText}>{cardErrors.expiryDate}</Text>
                )}
              </View>
              
              <View style={styles.halfInputContainer}>
                <TextInput
                  label={`CVV${cardType.type === 'amex' ? ' (4)' : ' (3)'}`}
                  value={cvv}
                  onChangeText={handleCvvChange}
                  style={[styles.input, styles.halfInput]}
                  keyboardType="numeric"
                  maxLength={cardType.type === 'amex' ? 4 : 3}
                  secureTextEntry
                  error={!!cardErrors.cvv}
                  theme={{ colors: { primary: serviceColor } }}
                />
                {cardErrors.cvv && (
                  <Text style={styles.errorText}>{cardErrors.cvv}</Text>
                )}
              </View>
            </View>
            
            <TextInput
              label="Nom sur la carte"
              value={nameOnCard}
              onChangeText={setNameOnCard}
              style={styles.input}
              autoCapitalize="words"
              error={!!cardErrors.nameOnCard}
              theme={{ colors: { primary: serviceColor } }}
            />
            {cardErrors.nameOnCard && (
              <Text style={styles.errorText}>{cardErrors.nameOnCard}</Text>
            )}
          </Card.Content>
        </Card>
      )}
      
      {/* Bouton de confirmation */}
      <View style={styles.buttonContainer}>
        {isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={serviceColor} />
            <Text style={styles.processingText}>{processingStep}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.reserveButton, { backgroundColor: serviceColor }]}
            onPress={handleConfirmReservation}
            activeOpacity={0.8}
          >
            <View style={styles.reserveButtonContent}>
              <Text style={styles.reserveButtonText}>
                PAYER {formatPrice(platformFees.platformFee)}
              </Text>
              <Text style={styles.reserveButtonSubtext}>
                Et confirmer la réservation
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color="white" />
          </TouchableOpacity>
        )}
        
        <View style={styles.securityInfo}>
          <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
          <Text style={styles.securityInfoText}>
            Paiement sécurisé SSL - Annulation gratuite
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
    marginBottom: 10,
  },
  platformFeeAmount: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  securityText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  explanationCard: {
    margin: 15,
    borderRadius: 12,
    elevation: 4,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  explanationSteps: {
    marginBottom: 15,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    color: 'white',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 24,
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  benefitsBox: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 13,
    color: '#2E7D32',
    marginBottom: 4,
  },
  priceBreakdownContainer: {
    marginHorizontal: 15,
  },
  paymentMethodCard: {
    margin: 15,
    marginTop: 5,
    borderRadius: 12,
    elevation: 4,
  },
  cardDetailsCard: {
    margin: 15,
    marginTop: 5,
    borderRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  cardTypeName: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 15,
    fontWeight: 'bold',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
  },
  radioContent: {
    marginLeft: 12,
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  radioDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  input: {
    marginBottom: 15,
    backgroundColor: 'transparent',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  halfInputContainer: {
    flex: 1,
  },
  halfInput: {
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 5,
  },
  buttonContainer: {
    padding: 15,
    marginBottom: 30,
  },
  reserveButton: {
    borderRadius: 16,
    marginBottom: 15,
    elevation: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 25,
  },
  reserveButtonContent: {
    flex: 1,
  },
  reserveButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 1,
  },
  reserveButtonSubtext: {
    fontSize: 12,
    color: 'white',
    opacity: 0.9,
    marginTop: 4,
  },
  processingContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 4,
  },
  processingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  securityInfoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    textAlign: 'center',
    flex: 1,
  }
});

export default PaymentScreen;