// src/screens/booking/PaymentScreen.js
// ✅ Tranzila real pre-auth (card) + Bit WebView

import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, TouchableOpacity,
  TextInput as RNTextInput, Modal, SafeAreaView
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useBooking } from '../../context/BookingContext';
import { API_URL, SERVICE_TYPE_LABELS, calculatePlatformFees, PLATFORM_FEES, getServiceColor, getServiceBackgroundColor } from '../../config/constants';

import PriceBreakdown from '../../components/PriceBreakdown';
import AsyncStorage from '@react-native-async-storage/async-storage';


// ─── Validation ───────────────────────────────────────────────────────────────
const CardValidation = {
  validateCardNumber: (cardNumber) => {
    const cleaned = cardNumber.replace(/\s+/g, '');
    return /^\d{13,19}$/.test(cleaned);
  },
  getCardType: (cardNumber) => {
    const cleaned = cardNumber.replace(/\s+/g, '');
    if (/^4/.test(cleaned)) return { type: 'visa', name: 'Visa' };
    if (/^5[1-5]/.test(cleaned)) return { type: 'mastercard', name: 'MasterCard' };
    if (/^3[47]/.test(cleaned)) return { type: 'amex', name: 'Amex' };
    return { type: 'unknown', name: '' };
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
const PaymentScreen = ({ navigation }) => {
  const { currentBooking, createBooking } = useBooking();

  const serviceColor = getServiceColor(currentBooking.serviceType);
  const serviceBgColor = getServiceBackgroundColor(currentBooking.serviceType);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState('card');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');
  const [cardType, setCardType] = useState({ type: 'unknown', name: '' });
  const [cardErrors, setCardErrors] = useState({});

  // Bit WebView
  const [bitWebViewVisible, setBitWebViewVisible] = useState(false);
  const [bitSaleUrl, setBitSaleUrl] = useState('');
  const [bitRequestId, setBitRequestId] = useState('');

  const platformFees = calculatePlatformFees(
    currentBooking.price, false, currentBooking.serviceType
  );

  // ─── Card helpers ──────────────────────────────────────────────────────────
  useEffect(() => {
    setCardType(cardNumber.length > 4
      ? CardValidation.getCardType(cardNumber)
      : { type: 'unknown', name: '' }
    );
  }, [cardNumber]);

  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\D/g, '');
    return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
  };

  const handleCardNumberChange = (text) => {
    const formatted = formatCardNumber(text);
    setCardNumber(formatted);
    const errors = { ...cardErrors };
    if (text.length > 0 && !CardValidation.validateCardNumber(formatted)) {
      errors.cardNumber = 'מספר כרטיס לא תקין';
    } else { delete errors.cardNumber; }
    setCardErrors(errors);
  };

  const formatExpiryDate = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 2) return cleaned;
    const month = cleaned.substring(0, 2);
    const year = cleaned.substring(2, 4);
    return `${parseInt(month) > 12 ? '12' : month}/${year}`;
  };

  const handleExpiryDateChange = (text) => {
    const formatted = formatExpiryDate(text);
    setExpiryDate(formatted);
    const errors = { ...cardErrors };
    if (formatted.length === 5) {
      const [month, year] = formatted.split('/');
      if (new Date(`20${year}`, month - 1) <= new Date()) {
        errors.expiryDate = 'הכרטיס פג תוקף';
      } else { delete errors.expiryDate; }
    }
    setCardErrors(errors);
  };

  const handleCvvChange = (text) => {
    const cleaned = text.replace(/\D/g, '');
    setCvv(cleaned);
    const errors = { ...cardErrors };
    const expectedLen = cardType.type === 'amex' ? 4 : 3;
    if (cleaned.length > 0 && cleaned.length !== expectedLen) {
      errors.cvv = `CVV חייב להכיל ${expectedLen} ספרות`;
    } else { delete errors.cvv; }
    setCardErrors(errors);
  };

  const validatePaymentFields = () => {
    const errors = {};
    if (!cardNumber || !CardValidation.validateCardNumber(cardNumber))
      errors.cardNumber = 'מספר כרטיס לא תקין';
    if (!expiryDate || expiryDate.length < 5)
      errors.expiryDate = 'תאריך תפוגה לא תקין';
    const expectedCvv = cardType.type === 'amex' ? 4 : 3;
    if (!cvv || cvv.length !== expectedCvv)
      errors.cvv = `CVV חייב להכיל ${expectedCvv} ספרות`;
    if (!nameOnCard || nameOnCard.length < 2)
      errors.nameOnCard = 'נא להזין שם בעל הכרטיס';
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getToken = () => AsyncStorage.getItem('token');

  // ─── CARD: pre-auth via Tranzila ──────────────────────────────────────────
  const chargeCard = async () => {
    const token = await getToken();
    const [expmonth, expyear] = expiryDate.split('/');
    const cleanedCard = cardNumber.replace(/\s+/g, '');

    const response = await fetch(`${API_URL}/bookings/payments/card/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ccno: cleanedCard,
        expmonth,
        expyear: `20${expyear}`,
        cvv,
        holdername: nameOnCard,
        amount: platformFees.platformFee,
        servicePrice: currentBooking.price,
        serviceType: currentBooking.serviceType || 'home',
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'התשלום נכשל. בדוק את פרטי הכרטיס.');
    }
    // ✅ FIX — retourne { paymentIntentId, tranzilaIndex, authnumber }
    return data.data;
  };

  // ─── BIT: init ────────────────────────────────────────────────────────────
  const initBit = async () => {
    const token = await getToken();
    const response = await fetch(`${API_URL}/bookings/payments/bit/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: platformFees.platformFee,
        servicePrice: currentBooking.price,
        serviceType: currentBooking.serviceType || 'home',
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'לא ניתן לאתחל תשלום Bit.');
    }
    return data.data; // { saleUrl, requestId }
  };

  // ─── BIT: WebView navigation handler ─────────────────────────────────────
  const handleBitNavChange = (navState) => {
    const url = navState.url || '';

    if (url.includes('/payments/bit/success') || url.includes('bit/success')) {
      setBitWebViewVisible(false);
      finalizeBitBooking(true);
    } else if (url.includes('/payments/bit/failure') || url.includes('bit/failure') || url.includes('bit/cancel')) {
      setBitWebViewVisible(false);
      Alert.alert('תשלום Bit נכשל', 'הפעולה בוטלה. נסה שנית.');
      setIsProcessing(false);
    }
  };

  const finalizeBitBooking = async (success) => {
    if (!success) return;
    try {
      setProcessingStep('יוצר הזמנה...');
      const bookingResult = await createBooking({
        paymentIntentId: null,
        paymentMethod: 'bit',
        bitRequestId,
      });

      if (bookingResult.success) {
        navigation.reset({
          index: 0,
          routes: [{
            name: 'BookingConfirmation',
            params: {
              bookingId: bookingResult.booking._id,
              requestType: 'pending',
              paymentMethod: 'bit',
              platformFee: platformFees.platformFee,
            }
          }],
        });
      } else {
        throw new Error(bookingResult.message || 'כשל ביצירת ההזמנה');
      }
    } catch (error) {
      Alert.alert('שגיאה', error.message);
      setIsProcessing(false);
    } finally {
      setProcessingStep('');
    }
  };

  // ─── Main confirm handler ─────────────────────────────────────────────────
  const handleConfirmReservation = async () => {
    if (paymentMethod === 'card' && !validatePaymentFields()) {
      Alert.alert('שגיאה', 'אנא תקן את השגיאות בטופס');
      return;
    }

    setIsProcessing(true);

    try {
      if (paymentMethod === 'card') {
        setProcessingStep('מעבד תשלום...');

        // ✅ FIX — destructuration correcte : paymentIntentId séparé de tranzilaIndex
        // Avant : const { tranzilaIndex, authnumber } = await chargeCard();
        //         → paymentIntentId: tranzilaIndex  (index numérique passé à la place de l'intentId)
        // Après : les 3 valeurs sont distinctes et correctement transmises à createBooking
        const { paymentIntentId, tranzilaIndex, authnumber } = await chargeCard();

        setProcessingStep('יוצר הזמנה...');
        const bookingResult = await createBooking({
          paymentIntentId,   // ✅ "trz_XXXXX_YYYYY"
          paymentMethod: 'card',
          tranzilaIndex,     // ✅ index numérique Tranzila (clé du remboursement)
          authnumber,
        });

        if (bookingResult.success) {
          navigation.reset({
            index: 0,
            routes: [{
              name: 'BookingConfirmation',
              params: {
                bookingId: bookingResult.booking._id,
                requestType: 'pending',
                paymentMethod: 'card',
                platformFee: platformFees.platformFee,
                tranzilaIndex,
              }
            }],
          });
        } else {
          throw new Error(bookingResult.message || 'כשל ביצירת ההזמנה');
        }

      } else if (paymentMethod === 'bit') {
        setProcessingStep('מאתחל תשלום Bit...');
        const { saleUrl, requestId } = await initBit();
        setBitSaleUrl(saleUrl);
        setBitRequestId(requestId);
        setBitWebViewVisible(true);
        setProcessingStep('');
      }

    } catch (error) {
      console.error('❌ Payment error:', error);
      Alert.alert('שגיאה בתשלום', error.message, [
        { text: 'אישור', onPress: () => setIsProcessing(false) }
      ]);
      setIsProcessing(false);
    } finally {
      if (paymentMethod === 'card') {
        setProcessingStep('');
      }
    }
  };

  const formatPrice = (price) => `${price.toFixed(2)} ${PLATFORM_FEES.CURRENCY}`;

  const getCardIcon = () =>
    cardType.type !== 'unknown' ? 'card' : 'card-outline';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: serviceBgColor }]}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-forward" size={20} color="#1F2937" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, styles.textRTL]}>תשלום עמלה</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={[styles.headerSubtitle, styles.textRTL]}>
            {SERVICE_TYPE_LABELS[currentBooking.serviceType]}
          </Text>

          <View style={[styles.amountBadge, { backgroundColor: `${serviceColor}10` }]}>
            <Text style={[styles.amountText, { color: serviceColor }, styles.textRTL]}>
              {formatPrice(platformFees.platformFee)}
            </Text>
          </View>
        </View>

        {/* HOW IT WORKS */}
        <View style={styles.explanationCard}>
          <View style={[styles.rtlRow, { alignItems: 'center', marginBottom: 16 }]}>
            <Ionicons name="information-circle-outline" size={18} color={serviceColor} style={styles.iconRTL} />
            <Text style={[styles.explanationTitle, styles.textRTL]}>איך זה עובד?</Text>
          </View>

          {[
            'תשלם רק ' + formatPrice(platformFees.platformFee) + ' עכשיו',
            'הכסף יוחזק בנאמנות עד אישור הספק',
            'אם הספק מאשר - תקבל את מספר הטלפון שלו',
            'אם הספק מסרב - החזר כספי מלא אוטומטית',
          ].map((text, i) => (
            <View key={i} style={[styles.step, styles.rtlRow]}>
              <View style={[styles.stepBadge, { backgroundColor: `${serviceColor}10` }]}>
                <Text style={[styles.stepNumber, { color: serviceColor }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, styles.textRTL]}>{text}</Text>
            </View>
          ))}

          <View style={[styles.benefitsBox, { backgroundColor: `${serviceColor}08` }]}>
            <Text style={[styles.benefitItem, styles.textRTL]}>✓ הכסף שלך מוגן עד לאישור הספק</Text>
            <Text style={[styles.benefitItem, styles.textRTL]}>✓ החזר כספי אוטומטי במקרה של סירוב</Text>
            <Text style={[styles.benefitItem, styles.textRTL]}>✓ אין עמלות נסתרות</Text>
          </View>
        </View>

        {/* PRICE */}
        <View style={styles.priceContainer}>
          <PriceBreakdown
            servicePrice={currentBooking.price}
            serviceType={currentBooking.serviceType}
            platformFee={platformFees.platformFee}
            showOnlyPlatformFee={true}
          />
        </View>

        {/* PAYMENT METHOD SELECTOR */}
        <View style={styles.paymentCard}>
          <Text style={[styles.sectionLabel, styles.textRTL]}>שיטת תשלום</Text>

          {/* Card option */}
          <TouchableOpacity
            style={[
              styles.radioOption,
              paymentMethod === 'card' && { borderColor: serviceColor, borderWidth: 1.5 }
            ]}
            onPress={() => setPaymentMethod('card')}
          >
            <View style={[styles.radioCircle, paymentMethod === 'card' && { borderColor: serviceColor }]}>
              {paymentMethod === 'card' && (
                <View style={[styles.radioCircleSelected, { backgroundColor: serviceColor }]} />
              )}
            </View>
            <View style={styles.radioContent}>
              <View style={[styles.rtlRow, { alignItems: 'center' }]}>
                <Ionicons name="card-outline" size={16} color="#6B7280" style={styles.iconRTL} />
                <Text style={[styles.radioLabel, styles.textRTL]}>כרטיס אשראי</Text>
              </View>
              <Text style={[styles.radioDescription, styles.textRTL]}>תשלום מאובטח ומוצפן</Text>
            </View>
          </TouchableOpacity>

          {/* Bit option */}
          <TouchableOpacity
            style={[
              styles.radioOption,
              { marginTop: 10 },
              paymentMethod === 'bit' && { borderColor: serviceColor, borderWidth: 1.5 }
            ]}
            onPress={() => setPaymentMethod('bit')}
          >
            <View style={[styles.radioCircle, paymentMethod === 'bit' && { borderColor: serviceColor }]}>
              {paymentMethod === 'bit' && (
                <View style={[styles.radioCircleSelected, { backgroundColor: serviceColor }]} />
              )}
            </View>
            <View style={styles.radioContent}>
              <View style={[styles.rtlRow, { alignItems: 'center' }]}>
                <View style={styles.bitBadge}>
                  <Text style={styles.bitBadgeText}>bit</Text>
                </View>
                <Text style={[styles.radioLabel, styles.textRTL]}>תשלום עם Bit</Text>
              </View>
              <Text style={[styles.radioDescription, styles.textRTL]}>
                תשלום מהיר דרך אפליקציית Bit
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* CARD FORM — shown only when card is selected */}
        {paymentMethod === 'card' && (
          <View style={styles.cardDetailsCard}>
            <View style={styles.cardHeader}>
              <Text style={[styles.sectionLabel, styles.textRTL]}>פרטי כרטיס</Text>
              {cardType.name ? (
                <View style={[styles.cardTypeBadge, { backgroundColor: `${serviceColor}10` }]}>
                  <Text style={[styles.cardTypeText, { color: serviceColor }]}>{cardType.name}</Text>
                </View>
              ) : null}
            </View>

            {/* Card number */}
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
                  placeholderTextColor="#D1D5DB"
                />
                <Ionicons name={getCardIcon()} size={18} color="#9CA3AF" />
              </View>
              {cardErrors.cardNumber && (
                <Text style={[styles.errorText, styles.textRTL]}>{cardErrors.cardNumber}</Text>
              )}
            </View>

            {/* Expiry + CVV */}
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
                    placeholderTextColor="#D1D5DB"
                    style={[styles.textInput, styles.textInputRTL]}
                  />
                </View>
                {cardErrors.expiryDate && (
                  <Text style={[styles.errorText, styles.textRTL]}>{cardErrors.expiryDate}</Text>
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
                    placeholderTextColor="#D1D5DB"
                    style={[styles.textInput, styles.textInputRTL]}
                  />
                </View>
                {cardErrors.cvv && (
                  <Text style={[styles.errorText, styles.textRTL]}>{cardErrors.cvv}</Text>
                )}
              </View>
            </View>

            {/* Name */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, styles.textRTL]}>שם בעל הכרטיס</Text>
              <View style={[styles.inputWrapper, cardErrors.nameOnCard && styles.inputError]}>
                <RNTextInput
                  value={nameOnCard}
                  onChangeText={setNameOnCard}
                  style={[styles.textInput, styles.textInputRTL]}
                  placeholder="ישראל ישראלי"
                  placeholderTextColor="#D1D5DB"
                />
              </View>
              {cardErrors.nameOnCard && (
                <Text style={[styles.errorText, styles.textRTL]}>{cardErrors.nameOnCard}</Text>
              )}
            </View>
          </View>
        )}

       {/* SUBMIT */}
<View style={styles.buttonContainer}>

{__DEV__ && (
  <TouchableOpacity
    style={[styles.primaryButton, { backgroundColor: '#6B7280', marginBottom: 10 }]}
    onPress={() => createBooking({ paymentMethod: 'test', paymentIntentId: 'test_123' }).then(res => {
      if (res.success) navigation.reset({
        index: 0,
        routes: [{ name: 'BookingConfirmation', params: { bookingId: res.booking._id, requestType: 'pending' } }]
      });
    })}
  >
    <Text style={[styles.primaryButtonText, styles.textRTL]}>🧪 Test sans paiement</Text>
  </TouchableOpacity>
)}

{isProcessing ? (
  <View style={styles.processingContainer}>
    <ActivityIndicator size="small" color={serviceColor} />
    <Text style={[styles.processingText, styles.textRTL]}>
      {processingStep || 'מעבד...'}
    </Text>
  </View>
) : (
  <TouchableOpacity
    style={[styles.primaryButton, { backgroundColor: serviceColor }]}
    onPress={handleConfirmReservation}
    activeOpacity={0.8}
  >
    {paymentMethod === 'bit' ? (
      <View style={styles.rtlRow}>
        <View style={styles.bitBadgeWhite}>
          <Text style={styles.bitBadgeTextWhite}>bit</Text>
        </View>
        <Text style={[styles.primaryButtonText, styles.textRTL]}>
          שלם עם Bit — {formatPrice(platformFees.platformFee)}
        </Text>
      </View>
    ) : (
      <Text style={[styles.primaryButtonText, styles.textRTL]}>
        שלם {formatPrice(platformFees.platformFee)}
      </Text>
    )}
  </TouchableOpacity>
)}

<View style={[styles.securityBadge, styles.rtlRow]}>
  <Ionicons name="lock-closed" size={12} color="#10B981" style={styles.iconRTL} />
  <Text style={[styles.securityText, styles.textRTL]}>תשלום מאובטח ומוצפן</Text>
</View>
</View>
</ScrollView>

      {/* BIT WEBVIEW MODAL */}
      <Modal
        visible={bitWebViewVisible}
        animationType="slide"
        onRequestClose={() => {
          setBitWebViewVisible(false);
          setIsProcessing(false);
        }}
      >
        <SafeAreaView style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity
              style={styles.webViewClose}
              onPress={() => {
                setBitWebViewVisible(false);
                setIsProcessing(false);
              }}
            >
              <Ionicons name="close" size={22} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.webViewTitle}>תשלום עם Bit</Text>
            <View style={{ width: 36 }} />
          </View>

          <WebView
            source={{ uri: bitSaleUrl }}
            onNavigationStateChange={handleBitNavChange}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color={serviceColor} />
                <Text style={styles.webViewLoadingText}>טוען Bit...</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: {
    fontSize: 17, fontWeight: '600', color: '#1F2937',
    textAlign: 'center', flex: 1, letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13, color: '#9CA3AF',
    textAlign: 'center', marginBottom: 12,
  },
  amountBadge: {
    alignSelf: 'center', paddingHorizontal: 16,
    paddingVertical: 6, borderRadius: 6,
  },
  amountText: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },

  // Explanation
  explanationCard: {
    marginHorizontal: 16, marginTop: 24, marginBottom: 16,
    padding: 20, backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6',
  },
  explanationTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  step: { marginBottom: 12, alignItems: 'flex-start' },
  stepBadge: {
    width: 24, height: 24, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  stepNumber: { fontSize: 11, fontWeight: '600' },
  stepText: { flex: 1, fontSize: 13, color: '#1F2937', lineHeight: 18 },
  benefitsBox: { padding: 12, borderRadius: 8, marginTop: 4 },
  benefitItem: { fontSize: 12, color: '#1F2937', marginBottom: 6 },

  // Price
  priceContainer: { marginHorizontal: 16, marginBottom: 16 },

  // Payment method
  paymentCard: {
    marginHorizontal: 16, marginBottom: 16,
    padding: 20, backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '500', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
  },
  radioOption: {
    flexDirection: 'row-reverse', alignItems: 'center',
    padding: 12, backgroundColor: '#F9FAFB',
    borderRadius: 8, borderWidth: 1, borderColor: 'transparent',
  },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  radioCircleSelected: { width: 10, height: 10, borderRadius: 5 },
  radioContent: { flex: 1 },
  radioLabel: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  radioDescription: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Bit badge
  bitBadge: {
    backgroundColor: '#1A1A2E', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, marginLeft: 8,
  },
  bitBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  bitBadgeWhite: {
    backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6,
    paddingVertical: 1, borderRadius: 4, marginLeft: 8,
  },
  bitBadgeTextWhite: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // Card details
  cardDetailsCard: {
    marginHorizontal: 16, marginBottom: 16,
    padding: 20, backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  cardTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  cardTypeText: { fontSize: 11, fontWeight: '500' },
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row-reverse', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    backgroundColor: '#FFFFFF', paddingHorizontal: 12, height: 40,
  },
  inputError: { borderColor: '#EF4444' },
  textInput: { flex: 1, fontSize: 14, color: '#1F2937' },
  textInputRTL: { textAlign: 'right', writingDirection: 'rtl' },
  rowInputs: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12,
  },
  halfInputContainer: { flex: 1 },
  errorText: { fontSize: 11, color: '#EF4444', marginTop: 6 },

  // Button
  buttonContainer: { paddingHorizontal: 16, paddingBottom: 32 },
  primaryButton: {
    height: 44, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  primaryButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  processingContainer: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    padding: 16, backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 12,
  },
  processingText: { fontSize: 13, color: '#1F2937', marginRight: 12 },
  securityBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
  },
  securityText: { fontSize: 12, color: '#6B7280' },

  // WebView modal
  webViewContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  webViewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  webViewClose: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB',
  },
  webViewTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  webViewLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
  webViewLoadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },

  // RTL utils
  rtlRow: { flexDirection: 'row-reverse' },
  textRTL: { textAlign: 'right', writingDirection: 'rtl' },
  iconRTL: { marginLeft: 8, marginRight: 0 },
});

export default PaymentScreen;