// src/screens/booking/PaymentScreen.js
// ✅ VERSION MODERNE - Navigation intégrée dans le header coloré
// ✅ Plus de barre bleue séparée - tout est dans le rectangle vert

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, Card, Title, Divider, ActivityIndicator, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, calculatePlatformFees, PLATFORM_FEES, getServiceColor } from '../../config/constants';
import PriceBreakdown from '../../components/PriceBreakdown';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const CardValidation = {
  validateCardNumber: (cardNumber) => {
    const cleaned = cardNumber.replace(/\s+/g, '');
    return /^\d{13,19}$/.test(cleaned) && cleaned.length >= 13;
  },

  getCardType: (cardNumber) => {
    const cleaned = cardNumber.replace(/\s+/g, '');
    
    if (/^4/.test(cleaned)) return { type: 'visa', name: 'Visa' };
    if (/^5[1-5]/.test(cleaned)) return { type: 'mastercard', name: 'MasterCard' };
    if (/^3[47]/.test(cleaned)) return { type: 'amex', name: 'American Express' };
    
    return { type: 'unknown', name: '' };
  }
};

const PaymentScreen = ({ navigation }) => {
  const theme = useTheme();
  const { currentBooking, createBooking } = useBooking();
  
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');
  const [cardType, setCardType] = useState({ type: 'unknown', name: '' });
  
  const [cardErrors, setCardErrors] = useState({});

  const isRTL = true;

  useEffect(() => {
    if (cardNumber.length > 4) {
      setCardType(CardValidation.getCardType(cardNumber));
    } else {
      setCardType({ type: 'unknown', name: '' });
    }
  }, [cardNumber]);

  const serviceColor = getServiceColor(currentBooking.serviceType);
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
    if (text.length > 0 && !CardValidation.validateCardNumber(formatted)) {
      errors.cardNumber = 'מספר כרטיס לא תקין';
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
        errors.expiryDate = 'הכרטיס פג תוקף';
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
      errors.cvv = `CVV חייב להכיל ${expectedLength} ספרות`;
    } else {
      delete errors.cvv;
    }
    setCardErrors(errors);
  };

  const validatePaymentFields = () => {
    const errors = {};
    
    if (paymentMethod === 'card') {
      if (!cardNumber || !CardValidation.validateCardNumber(cardNumber)) {
        errors.cardNumber = 'מספר כרטיס לא תקין';
      }
      
      if (!expiryDate || expiryDate.length < 5) {
        errors.expiryDate = 'תאריך תפוגה לא תקין';
      }
      
      const expectedCvvLength = cardType.type === 'amex' ? 4 : 3;
      if (!cvv || cvv.length !== expectedCvvLength) {
        errors.cvv = `CVV חייב להכיל ${expectedCvvLength} ספרות`;
      }
      
      if (!nameOnCard || nameOnCard.length < 2) {
        errors.nameOnCard = 'נא להזין שם בעל הכרטיס';
      }
    }
    
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createPaymentIntent = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/bookings/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: platformFees.platformFee,
          servicePrice: currentBooking.price,
          bookingId: 'pending'
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'שגיאה ביצירת התשלום');
      }

      return data.data.paymentIntentId;

    } catch (error) {
      console.error('❌ Error creating payment intent:', error);
      throw new Error('לא ניתן ליצור את התשלום. בדוק את החיבור.');
    }
  };

  const handleConfirmReservation = async () => {
    if (paymentMethod === 'card' && !validatePaymentFields()) {
      Alert.alert('שגיאה', 'אנא תקן את השגיאות בטופס');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      let paymentIntentId = null;
      
      if (paymentMethod === 'card') {
        setProcessingStep('יוצר intent תשלום...');
        
        paymentIntentId = await createPaymentIntent();
        
        console.log('✅ Payment intent créé:', paymentIntentId);
        setProcessingStep('תשלום בהמתנה...');
      }
      
      setProcessingStep('יוצר הזמנה...');
      
      const bookingResult = await createBooking({
        paymentIntentId,
        paymentMethod
      });
      
      if (bookingResult.success) {
        navigation.reset({
          index: 0,
          routes: [{ 
            name: 'BookingConfirmation', 
            params: { 
              bookingId: bookingResult.booking._id,
              requestType: 'pending',
              paymentMethod: paymentMethod,
              platformFee: platformFees.platformFee,
              paymentIntentId: paymentIntentId
            } 
          }],
        });
      } else {
        throw new Error(bookingResult.message || 'כשל ביצירת ההזמנה');
      }
      
    } catch (error) {
      console.error('❌ Payment error:', error);
      Alert.alert('שגיאה', error.message, [
        { text: 'אישור', onPress: () => setIsProcessing(false) }
      ]);
      setIsProcessing(false);
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
            <Title style={[styles.headerTitle, styles.textRTL]}>
              תשלום עמלת הזמנה
            </Title>
          </View>
          <View style={{ width: 40 }} />
        </View>
        
        <Text style={[styles.headerSubtitle, styles.textRTL]}>
          {SERVICE_TYPE_LABELS[currentBooking.serviceType]}
        </Text>
        <Text style={[styles.platformFeeAmount, styles.textRTL]}>
          עמלת הזמנה: {formatPrice(platformFees.platformFee)}
        </Text>
        
        <View style={[styles.securityBadge, styles.rtlRow]}>
          <Ionicons 
            name="shield-checkmark" 
            size={16} 
            color="white"
            style={styles.iconRTL}
          />
          <Text style={[styles.securityText, styles.textRTL]}>
            תשלום מאובטח
          </Text>
        </View>
      </View>

      <Card style={styles.explanationCard}>
        <Card.Content>
          <View style={[styles.explanationHeader, styles.rtlRow]}>
            <Ionicons 
              name="information-circle" 
              size={24} 
              color={serviceColor}
              style={styles.iconRTL}
            />
            <Text style={[styles.explanationTitle, styles.textRTL]}>
              איך זה עובד?
            </Text>
          </View>
          
          <View style={styles.explanationSteps}>
            <View style={[styles.step, styles.rtlRow]}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={[styles.stepText, styles.textRTL]}>
                תשלם רק {formatPrice(platformFees.platformFee)} עמלת הזמנה עכשיו
              </Text>
            </View>
            
            <View style={[styles.step, styles.rtlRow]}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={[styles.stepText, styles.textRTL]}>
                הכסף יוחזק בנאמנות עד שהספק יאשר
              </Text>
            </View>
            
            <View style={[styles.step, styles.rtlRow]}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={[styles.stepText, styles.textRTL]}>
                אם הספק מאשר - תקבל את מספר הטלפון שלו
              </Text>
            </View>
            
            <View style={[styles.step, styles.rtlRow]}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={[styles.stepText, styles.textRTL]}>
                אם הספק מסרב - תקבל החזר כספי מלא אוטומטית
              </Text>
            </View>
          </View>
          
          <View style={styles.benefitsBox}>
            <Text style={[styles.benefitsTitle, styles.textRTL]}>
              ✓ הגנה מלאה
            </Text>
            <Text style={[styles.benefitText, styles.textRTL]}>
              • הכסף שלך מוגן עד לאישור הספק
            </Text>
            <Text style={[styles.benefitText, styles.textRTL]}>
              • החזר כספי אוטומטי במקרה של סירוב
            </Text>
            <Text style={[styles.benefitText, styles.textRTL]}>
              • אין עמלות נסתרות
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.priceBreakdownContainer}>
        <PriceBreakdown 
          servicePrice={currentBooking.price}
          platformFee={platformFees.platformFee}
          showOnlyPlatformFee={true}
        />
      </View>

      <Card style={styles.paymentMethodCard}>
        <Card.Content>
          <Title style={[styles.sectionTitle, styles.textRTL]}>
            שיטת תשלום
          </Title>
          
          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setPaymentMethod('card')}
          >
            <View style={styles.radioCircle}>
              {paymentMethod === 'card' && <View style={styles.radioCircleSelected} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={[styles.radioLabel, styles.textRTL]}>
                כרטיס אשראי
              </Text>
              <Text style={[styles.radioDescription, styles.textRTL]}>
                תשלום מאובטח עם הגנה מלאה
              </Text>
            </View>
          </TouchableOpacity>
        </Card.Content>
      </Card>

      {paymentMethod === 'card' && (
        <Card style={styles.cardDetailsCard}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Title style={[styles.sectionTitle, styles.textRTL]}>
                פרטי כרטיס אשראי
              </Title>
              {cardType.name && (
                <View style={styles.cardTypeIndicator}>
                  <Ionicons name={getCardIcon()} size={20} color="#666" />
                  <Text style={styles.cardTypeName}>{cardType.name}</Text>
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, styles.textRTL]}>מספר כרטיס</Text>
              <View style={[styles.inputWrapper, cardErrors.cardNumber && styles.inputError]}>
                <RNTextInput
                  value={cardNumber}
                  onChangeText={handleCardNumberChange}
                  keyboardType="numeric"
                  maxLength={19}
                  style={[styles.textInput, styles.textInputRTL]}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor="#999"
                />
                <Ionicons name={getCardIcon()} size={20} color="#666" style={styles.inputIcon} />
              </View>
              {cardErrors.cardNumber && (
                <Text style={[styles.errorText, styles.textRTL]}>
                  {cardErrors.cardNumber}
                </Text>
              )}
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfInputContainer}>
                <Text style={[styles.inputLabel, styles.textRTL]}>MM/YY</Text>
                <View style={[styles.inputWrapper, cardErrors.expiryDate && styles.inputError]}>
                  <RNTextInput
                    value={expiryDate}
                    onChangeText={handleExpiryDateChange}
                    keyboardType="numeric"
                    maxLength={5}
                    placeholder="12/25"
                    placeholderTextColor="#999"
                    style={[styles.textInput, styles.textInputRTL]}
                  />
                </View>
                {cardErrors.expiryDate && (
                  <Text style={[styles.errorText, styles.textRTL]}>
                    {cardErrors.expiryDate}
                  </Text>
                )}
              </View>

              <View style={styles.halfInputContainer}>
                <Text style={[styles.inputLabel, styles.textRTL]}>CVV</Text>
                <View style={[styles.inputWrapper, cardErrors.cvv && styles.inputError]}>
                  <RNTextInput
                    value={cvv}
                    onChangeText={handleCvvChange}
                    keyboardType="numeric"
                    maxLength={cardType.type === 'amex' ? 4 : 3}
                    secureTextEntry
                    placeholder="123"
                    placeholderTextColor="#999"
                    style={[styles.textInput, styles.textInputRTL]}
                  />
                </View>
                {cardErrors.cvv && (
                  <Text style={[styles.errorText, styles.textRTL]}>
                    {cardErrors.cvv}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, styles.textRTL]}>שם בעל הכרטיס</Text>
              <View style={[styles.inputWrapper, cardErrors.nameOnCard && styles.inputError]}>
                <RNTextInput
                  value={nameOnCard}
                  onChangeText={setNameOnCard}
                  style={[styles.textInput, styles.textInputRTL]}
                  placeholder="ישראל ישראלי"
                  placeholderTextColor="#999"
                />
              </View>
              {cardErrors.nameOnCard && (
                <Text style={[styles.errorText, styles.textRTL]}>
                  {cardErrors.nameOnCard}
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>
      )}
      
      <View style={styles.buttonContainer}>
        {isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={serviceColor} />
            <Text style={[styles.processingText, styles.textRTL]}>
              {processingStep}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.reserveButton, { backgroundColor: serviceColor }]}
            onPress={handleConfirmReservation}
            activeOpacity={0.8}
          >
            <View style={[styles.reserveButtonContent, styles.rtlFlex]}>
              <Text style={[styles.reserveButtonText, styles.textRTL]}>
                שלם {formatPrice(platformFees.platformFee)}
              </Text>
              <Text style={[styles.reserveButtonSubtext, styles.textRTL]}>
                ואשר את ההזמנה
              </Text>
            </View>
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
        )}
        
        <View style={[styles.securityInfo, styles.rtlRow]}>
          <Ionicons 
            name="shield-checkmark" 
            size={16} 
            color="#4CAF50"
            style={styles.iconRTL}
          />
          <Text style={[styles.securityInfoText, styles.textRTL]}>
            🔒 התשלום שלך מאובטח ומוצפן
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  // ✅ HEADER MODERNE AVEC NAVIGATION INTÉGRÉE
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
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
    marginBottom: 8,
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
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    marginBottom: 8,
  },
  platformFeeAmount: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  securityBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  securityText: {
    color: 'white',
    fontSize: 12,
    marginRight: 6,
    fontWeight: '600',
  },
  explanationCard: {
    margin: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  explanationHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 15,
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 10,
  },
  explanationSteps: {
    marginBottom: 15,
  },
  step: {
    flexDirection: 'row-reverse',
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
    marginLeft: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  benefitsBox: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 13,
    color: '#2E7D32',
    marginBottom: 4,
  },
  priceBreakdownContainer: {
    marginHorizontal: 16,
  },
  paymentMethodCard: {
    margin: 16,
    marginTop: 5,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardDetailsCard: {
    margin: 16,
    marginTop: 5,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTypeIndicator: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  cardTypeName: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 5,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  
  radioOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 10,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6200ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioCircleSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6200ee',
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  radioDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: 'white',
    paddingHorizontal: 12,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  textInputRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputIcon: {
    marginLeft: 8,
  },
  rowInputs: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
  },
  halfInputContainer: {
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 5,
    marginRight: 5,
    fontWeight: '500',
  },
  buttonContainer: {
    padding: 16,
    marginBottom: 30,
  },
  reserveButton: {
    borderRadius: 14,
    marginBottom: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    flexDirection: 'row-reverse',
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
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
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
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  processingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  securityInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  securityInfoText: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 6,
    textAlign: 'center',
    flex: 1,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlFlex: {
    marginLeft: 0,
    marginRight: 12,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  iconRTL: {
    marginLeft: 6,
    marginRight: 0,
  },
});

export default PaymentScreen;