// src/screens/booking/PaymentScreen.js
// ✅ Tranzila real pre-auth (card) + Bit WebView + PREMIÈRE COMMANDE GRATUITE
// ✅ REFONTE BLEU CLAIR (maquette 05) : styles uniquement, logique de paiement inchangée

import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, TouchableOpacity,
  TextInput as RNTextInput, Modal, SafeAreaView
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useBooking } from '../../context/BookingContext';
import { API_URL, SERVICE_TYPE_LABELS, calculatePlatformFees, PLATFORM_FEES } from '../../config/constants';

import PriceBreakdown from '../../components/PriceBreakdown';
import { COLORS } from '../../config/theme';
import { TOP_SPACE } from '../../components/BlueUI';
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

  const serviceColor    = COLORS.primary;
  const serviceBgColor  = COLORS.canvas;

  // ✅ NOUVEAU : statut première commande gratuite (récupéré depuis le profil)
  const [isFreeOrder, setIsFreeOrder] = useState(false);
  const [loadingFreeCheck, setLoadingFreeCheck] = useState(true);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState('card');

  // Processing state
  const [isProcessing, setIsProcessing]     = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  // Card fields
  const [cardNumber, setCardNumber]   = useState('');
  const [expiryDate, setExpiryDate]   = useState('');
  const [cvv, setCvv]                 = useState('');
  const [nameOnCard, setNameOnCard]   = useState('');
  const [cardType, setCardType]       = useState({ type: 'unknown', name: '' });
  const [cardErrors, setCardErrors]   = useState({});

  // Bit WebView
  const [bitWebViewVisible, setBitWebViewVisible] = useState(false);
  const [bitSaleUrl, setBitSaleUrl]               = useState('');
  const [bitRequestId, setBitRequestId]           = useState('');

  const platformFees = calculatePlatformFees(
    currentBooking.price, false, currentBooking.serviceType
  );

  // ✅ Vérifier si première commande gratuite au montage
  useEffect(() => {
    const checkFreeOrder = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const res   = await fetch(`${API_URL}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data.firstOrderUsed === false) {
          setIsFreeOrder(true);
        }
      } catch (e) {
        console.log('⚠️ Impossible de vérifier firstOrderUsed:', e.message);
      } finally {
        setLoadingFreeCheck(false);
      }
    };
    checkFreeOrder();
  }, []);

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
    const year  = cleaned.substring(2, 4);
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
    const cleaned      = text.replace(/\D/g, '');
    const expectedLen  = cardType.type === 'amex' ? 4 : 3;
    setCvv(cleaned);
    const errors = { ...cardErrors };
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
    return data.data; // { paymentIntentId, tranzilaIndex, authnumber }
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
              bookingId:     bookingResult.booking._id,
              requestType:   'pending',
              paymentMethod: 'bit',
              platformFee:   platformFees.platformFee,
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

  // ─── ✅ NOUVEAU : Commande gratuite (première commande) ───────────────────
  const handleFreeOrder = async () => {
    setIsProcessing(true);
    setProcessingStep('יוצר הזמנה...');
    try {
      const bookingResult = await createBooking({
        paymentMethod:   'free',
        paymentIntentId: null,
      });

      if (bookingResult.success) {
        navigation.reset({
          index: 0,
          routes: [{
            name: 'BookingConfirmation',
            params: {
              bookingId:   bookingResult.booking._id,
              requestType: 'pending',
              paymentMethod: 'free',
              platformFee: 0,
              isFreeOrder: true,
            }
          }],
        });
      } else {
        throw new Error(bookingResult.message || 'כשל ביצירת ההזמנה');
      }
    } catch (error) {
      Alert.alert('שגיאה', error.message);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // ─── Main confirm handler ─────────────────────────────────────────────────
  const handleConfirmReservation = async () => {
    // ✅ Première commande : bypass paiement
    if (isFreeOrder) {
      handleFreeOrder();
      return;
    }

    if (paymentMethod === 'card' && !validatePaymentFields()) {
      Alert.alert('שגיאה', 'אנא תקן את השגיאות בטופס');
      return;
    }

    setIsProcessing(true);

    try {
      if (paymentMethod === 'card') {
        setProcessingStep('מעבד תשלום...');
        const { paymentIntentId, tranzilaIndex, authnumber } = await chargeCard();

        setProcessingStep('יוצר הזמנה...');
        const bookingResult = await createBooking({
          paymentIntentId,
          paymentMethod: 'card',
          tranzilaIndex,
          authnumber,
        });

        if (bookingResult.success) {
          navigation.reset({
            index: 0,
            routes: [{
              name: 'BookingConfirmation',
              params: {
                bookingId:     bookingResult.booking._id,
                requestType:   'pending',
                paymentMethod: 'card',
                platformFee:   platformFees.platformFee,
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
  const getCardIcon = () => cardType.type !== 'unknown' ? 'card' : 'card-outline';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: serviceBgColor }]}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="chevron-forward" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, styles.textRTL]}>
              {isFreeOrder ? 'הזמנה ראשונה חינם 🎁' : 'תשלום עמלה'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={[styles.headerSubtitle, styles.textRTL]}>
            {SERVICE_TYPE_LABELS[currentBooking.serviceType]}
          </Text>

          <View style={[styles.amountBadge, {
            backgroundColor: COLORS.tint
          }]}>
            <Text style={[
              styles.amountText,
              { color: COLORS.navy },
              styles.textRTL
            ]}>
              {isFreeOrder ? 'חינם!' : formatPrice(platformFees.platformFee)}
            </Text>
          </View>
        </View>

        {/* ✅ BANNER PREMIÈRE COMMANDE GRATUITE */}
        {isFreeOrder && (
          <View style={styles.freeOrderBanner}>
            <Text style={styles.freeOrderEmoji}>🎁</Text>
            <View style={styles.freeOrderTextContainer}>
              <Text style={[styles.freeOrderTitle, styles.textRTL]}>ההזמנה הראשונה שלך חינם!</Text>
              <Text style={[styles.freeOrderSubtitle, styles.textRTL]}>
                ממש עכשיו תוכל לנסות את CleanConnect ללא עלות
              </Text>
            </View>
          </View>
        )}

        {/* HOW IT WORKS */}
        <View style={styles.explanationCard}>
          <View style={[styles.rtlRow, { alignItems: 'center', marginBottom: 16 }]}>
            <Ionicons name="information-circle-outline" size={18} color={serviceColor} style={styles.iconRTL} />
            <Text style={[styles.explanationTitle, styles.textRTL]}>איך זה עובד?</Text>
          </View>

          {(isFreeOrder ? [
            'ההזמנה הראשונה שלך לגמרי חינם',
            'הספק יקבל את הבקשה שלך',
            'אם הספק מאשר - תקבל את מספר הטלפון שלו',
            'אם הספק מסרב - תוכל לחפש ספק אחר',
          ] : [
            'תשלם רק ' + formatPrice(platformFees.platformFee) + ' עכשיו',
            'הכסף יוחזק בנאמנות עד אישור הספק',
            'אם הספק מאשר - תקבל את מספר הטלפון שלו',
            'אם הספק מסרב - החזר כספי מלא אוטומטית',
          ]).map((text, i) => (
            <View key={i} style={[styles.step, styles.rtlRow]}>
              <View style={[styles.stepBadge, { backgroundColor: `${serviceColor}10` }]}>
                <Text style={[styles.stepNumber, { color: serviceColor }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, styles.textRTL]}>{text}</Text>
            </View>
          ))}

          <View style={[styles.benefitsBox, { backgroundColor: `${serviceColor}08` }]}>
            {isFreeOrder ? (
              <>
                <Text style={[styles.benefitItem, styles.textRTL]}>✓ הזמנה ראשונה ללא עלות</Text>
                <Text style={[styles.benefitItem, styles.textRTL]}>✓ אין צורך בפרטי כרטיס אשראי</Text>
                <Text style={[styles.benefitItem, styles.textRTL]}>✓ התנסות מלאה בפלטפורמה</Text>
              </>
            ) : (
              <>
                <Text style={[styles.benefitItem, styles.textRTL]}>✓ הכסף שלך מוגן עד לאישור הספק</Text>
                <Text style={[styles.benefitItem, styles.textRTL]}>✓ החזר כספי אוטומטי במקרה של סירוב</Text>
                <Text style={[styles.benefitItem, styles.textRTL]}>✓ אין עמלות נסתרות</Text>
              </>
            )}
          </View>
        </View>

        {/* PRICE — masqué si gratuit */}
        {!isFreeOrder && (
          <View style={styles.priceContainer}>
            <PriceBreakdown
              servicePrice={currentBooking.price}
              serviceType={currentBooking.serviceType}
              platformFee={platformFees.platformFee}
              showOnlyPlatformFee={true}
            />
          </View>
        )}

        {/* PAYMENT METHOD + CARD FORM — masqués si gratuit */}
        {!isFreeOrder && (
          <>
            {/* PAYMENT METHOD SELECTOR */}
            <View style={styles.paymentCard}>
              <Text style={[styles.sectionLabel, styles.textRTL]}>שיטת תשלום</Text>

              <TouchableOpacity
                style={[
                  styles.radioOption,
                  paymentMethod === 'card' && { borderColor: COLORS.accent }
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
                    <Ionicons name="card-outline" size={18} color={COLORS.navy} style={styles.iconRTL} />
                    <Text style={[styles.radioLabel, styles.textRTL]}>כרטיס אשראי</Text>
                  </View>
                  <Text style={[styles.radioDescription, styles.textRTL]}>תשלום מאובטח ומוצפן</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioOption,
                  { marginTop: 8 },
                  paymentMethod === 'bit' && { borderColor: COLORS.accent }
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

            {/* CARD FORM */}
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
                      placeholderTextColor={COLORS.textHint}
                    />
                    <Ionicons name={getCardIcon()} size={18} color={COLORS.textHint} />
                  </View>
                  {cardErrors.cardNumber && (
                    <Text style={[styles.errorText, styles.textRTL]}>{cardErrors.cardNumber}</Text>
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
                        placeholderTextColor={COLORS.textHint}
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
                        placeholderTextColor={COLORS.textHint}
                        style={[styles.textInput, styles.textInputRTL]}
                      />
                    </View>
                    {cardErrors.cvv && (
                      <Text style={[styles.errorText, styles.textRTL]}>{cardErrors.cvv}</Text>
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
                      placeholderTextColor={COLORS.textHint}
                    />
                  </View>
                  {cardErrors.nameOnCard && (
                    <Text style={[styles.errorText, styles.textRTL]}>{cardErrors.nameOnCard}</Text>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        {/* SUBMIT */}
        <View style={styles.buttonContainer}>

          {__DEV__ && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: COLORS.textMuted, marginBottom: 10 }]}
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

          {loadingFreeCheck ? (
            <ActivityIndicator size="small" color={serviceColor} style={{ marginVertical: 16 }} />
          ) : isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color={serviceColor} />
              <Text style={[styles.processingText, styles.textRTL]}>
                {processingStep || 'מעבד...'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: COLORS.primary }
              ]}
              onPress={handleConfirmReservation}
              activeOpacity={0.8}
            >
              {isFreeOrder ? (
                <Text style={[styles.primaryButtonText, styles.textRTL]}>
                  🎁 הזמן חינם
                </Text>
              ) : paymentMethod === 'bit' ? (
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

          {!isFreeOrder && (
            <View style={[styles.securityBadge, styles.rtlRow]}>
              <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} style={styles.iconRTL} />
              <Text style={[styles.securityText, styles.textRTL]}>תשלום מאובטח ומוצפן</Text>
            </View>
          )}
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
              <Ionicons name="close" size={22} color={COLORS.text} />
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
const CARD = {
  marginHorizontal: 18, marginBottom: 10,
  padding: 14, backgroundColor: COLORS.surface,
  borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    backgroundColor: COLORS.canvas,
    paddingTop: TOP_SPACE,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backButton: {
    width: 36, height: 36,
    alignItems: 'flex-end', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18, fontWeight: '600', color: COLORS.text,
    textAlign: 'center', flex: 1,
  },
  headerSubtitle: {
    fontSize: 13, color: COLORS.textMuted,
    textAlign: 'center', marginBottom: 10,
  },
  amountBadge: {
    alignSelf: 'center', paddingHorizontal: 18,
    paddingVertical: 7, borderRadius: 999,
  },
  amountText: { fontSize: 18, fontWeight: '700' },

  // ✅ Banner première commande gratuite
  freeOrderBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 10,
    padding: 14,
    backgroundColor: COLORS.tint,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  freeOrderEmoji: { fontSize: 28, marginLeft: 12 },
  freeOrderTextContainer: { flex: 1 },
  freeOrderTitle: {
    fontSize: 15, fontWeight: '700', color: COLORS.navy, marginBottom: 4,
  },
  freeOrderSubtitle: { fontSize: 13, color: COLORS.textBody },

  // Explanation
  explanationCard: { ...CARD, marginTop: 6 },
  explanationTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  step: { marginBottom: 10, alignItems: 'flex-start' },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  stepNumber: { fontSize: 12, fontWeight: '600' },
  stepText: { flex: 1, fontSize: 14, color: COLORS.textBody, lineHeight: 20 },
  benefitsBox: { padding: 12, borderRadius: 14, marginTop: 4 },
  benefitItem: { fontSize: 13, color: COLORS.navy, marginBottom: 6 },

  // Price
  priceContainer: { marginHorizontal: 18, marginBottom: 10 },

  // Payment method
  paymentCard: { ...CARD, backgroundColor: 'transparent', borderWidth: 0, padding: 0 },
  sectionLabel: {
    fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8,
  },
  radioOption: {
    flexDirection: 'row-reverse', alignItems: 'center',
    padding: 12, backgroundColor: COLORS.surface,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.radioOff,
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  radioCircleSelected: { width: 10, height: 10, borderRadius: 5 },
  radioContent: { flex: 1 },
  radioLabel: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  radioDescription: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Bit badge
  bitBadge: {
    backgroundColor: '#1A1A2E', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, marginLeft: 8,
  },
  bitBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  bitBadgeWhite: {
    backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6,
    paddingVertical: 1, borderRadius: 6, marginLeft: 8,
  },
  bitBadgeTextWhite: { color: COLORS.white, fontSize: 11, fontWeight: '700' },

  // Card details
  cardDetailsCard: { ...CARD },
  cardHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  cardTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  cardTypeText: { fontSize: 11, fontWeight: '500' },
  inputContainer: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row-reverse', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
    backgroundColor: COLORS.input, paddingHorizontal: 12, height: 46,
  },
  inputError: { borderColor: COLORS.error },
  textInput: { flex: 1, fontSize: 14, color: COLORS.text },
  textInputRTL: { textAlign: 'right', writingDirection: 'rtl' },
  rowInputs: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12,
  },
  halfInputContainer: { flex: 1 },
  errorText: { fontSize: 11, color: COLORS.error, marginTop: 6 },

  // Button
  buttonContainer: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28 },
  primaryButton: {
    minHeight: 54, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  primaryButtonText: { fontSize: 17, fontWeight: '600', color: COLORS.white },
  processingContainer: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    padding: 16, backgroundColor: COLORS.tint, borderRadius: 999, marginBottom: 8,
  },
  processingText: { fontSize: 14, color: COLORS.navy, marginRight: 12 },
  securityBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 4,
  },
  securityText: { fontSize: 12, color: COLORS.textMuted },

  // WebView modal
  webViewContainer: { flex: 1, backgroundColor: COLORS.surface },
  webViewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft,
  },
  webViewClose: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.tint,
  },
  webViewTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  webViewLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  webViewLoadingText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },

  // RTL utils
  rtlRow:    { flexDirection: 'row-reverse' },
  textRTL:   { textAlign: 'right', writingDirection: 'rtl' },
  iconRTL:   { marginLeft: 8, marginRight: 0 },
});

export default PaymentScreen;
