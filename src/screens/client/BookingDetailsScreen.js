// src/screens/client/BookingDetails.js
// ✅ תורגם לעברית ישירות ללא i18n
// ✅ תוקן: תצוגת תאריך בעברית
// ✅ ESCROW: הצגת מספר טלפון מותנית + סטטוס תשלום
// ✅ תוקן: React Native Paper Text variants

import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Linking, TextInput as RNTextInput } from 'react-native';
import { Text, Card, Divider, ActivityIndicator, Appbar, useTheme, Portal, Dialog, Avatar, IconButton } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { AuthContext } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// קבועים לסטטוס הזמנה
const BOOKING_STATUS = {
  PENDING_PAYMENT: 'pending_payment', // ✅ ESCROW
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ACCEPTED: 'accepted', // ✅ ESCROW
  DECLINED: 'declined', // ✅ ESCROW
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const BookingDetailsScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { bookingId } = route.params;
  const { userBookings, fetchUserBookings, cancelBooking, updateBookingStatus, currentBooking } = useBooking();
  const { userInfo } = useContext(AuthContext);
  const isRTL = true;
  
  const [booking, setBooking] = useState(null);
  const [displayAddress, setDisplayAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRatingDialogVisible, setIsRatingDialogVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isCancellationDialogVisible, setIsCancellationDialogVisible] = useState(false);
  const [isCompletionDialogVisible, setIsCompletionDialogVisible] = useState(false);
  
  // ✅ פונקציה: תוויות לסטטוסים בעברית
  const getBookingStatusLabel = (status) => {
    const statusLabels = {
      [BOOKING_STATUS.PENDING_PAYMENT]: 'ממתין לתשלום',
      [BOOKING_STATUS.PENDING]: 'ממתין לאישור ספק',
      [BOOKING_STATUS.CONFIRMED]: 'מאושר',
      [BOOKING_STATUS.ACCEPTED]: 'מאושר',
      [BOOKING_STATUS.DECLINED]: 'נדחה על ידי הספק',
      [BOOKING_STATUS.IN_PROGRESS]: 'בביצוע',
      [BOOKING_STATUS.COMPLETED]: 'הושלם',
      [BOOKING_STATUS.CANCELLED]: 'בוטל',
    };
    return statusLabels[status] || 'ממתין לאישור';
  };
  
  // צבעים לסטטוסים
  const BOOKING_STATUS_COLORS = {
    [BOOKING_STATUS.PENDING_PAYMENT]: '#FF9800',
    [BOOKING_STATUS.PENDING]: '#FF9800',
    [BOOKING_STATUS.CONFIRMED]: '#4CAF50',
    [BOOKING_STATUS.ACCEPTED]: '#4CAF50',
    [BOOKING_STATUS.DECLINED]: '#F44336',
    [BOOKING_STATUS.IN_PROGRESS]: '#2196F3',
    [BOOKING_STATUS.COMPLETED]: '#9C27B0',
    [BOOKING_STATUS.CANCELLED]: '#F44336',
  };
  
  // ✅ פונקציה: קביעת איזו כתובת להציג
  const determineDisplayAddress = async () => {
    try {
      if (currentBooking?.address) {
        setDisplayAddress(currentBooking.address.fullAddress);
        return;
      }
      
      if (booking?.address) {
        setDisplayAddress(booking.address.fullAddress || booking.address);
        return;
      }
      
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setDisplayAddress(user.address || 'כתובת לא צוינה');
      } else {
        setDisplayAddress('כתובת לא זמינה');
      }
    } catch (error) {
      setDisplayAddress('כתובת לא זמינה');
    }
  };
  
  useFocusEffect(
    React.useCallback(() => {
      determineDisplayAddress();
    }, [currentBooking?.address, booking?.address])
  );
  
  useEffect(() => {
    determineDisplayAddress();
  }, []);
  
  // טעינת פרטי ההזמנה
  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);
  
  const loadBookingDetails = async () => {
    setIsLoading(true);
    
    try {
      await fetchUserBookings();
      const foundBooking = userBookings.find(b => b._id === bookingId);
      
      if (foundBooking) {
        console.log('📋 Booking loaded:', foundBooking);
        setBooking(foundBooking);
      } else {
        // נתוני דמו
        setBooking({
          _id: bookingId,
          serviceType: 'home',
          status: BOOKING_STATUS.CONFIRMED,
          dateTime: new Date().toISOString(),
          duration: 2,
          frequency: 'one_time',
          price: 199.99,
          selectedProvider: {
            _id: 'provider-id',
            name: 'CleanPro Services',
            rating: 4.8,
            phone: '+972 50 123 4567',
          },
          notes: 'אנא הביאו את כל הציוד הדרוש',
          providerPhoneVisible: true, // ✅ Demo
        });
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את פרטי ההזמנה');
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatBookingDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'PPPP', { locale: he });
    } catch (error) {
      return 'תאריך לא זמין';
    }
  };
  
  const formatBookingTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'HH:mm');
    } catch (error) {
      return '';
    }
  };
    
  const getServiceColor = (serviceType) => {
    switch (serviceType) {
      case 'home':
        return theme.colors.homeService || '#4A90E2';    // 🏠 BLEU
      case 'office':
        return theme.colors.officeService || '#E67E22';  // 🏢 ORANGE (CORRIGÉ)
      case 'building':
        return theme.colors.buildingService || '#27AE60'; // 🏗️ VERT (CORRIGÉ)
      case 'airbnb':
        return theme.colors.airbnbService || '#FF5A5F';  // 🏨 ROSE
      default:
        return theme.colors.primary;
    }
  };
  
  const getServiceTypeLabel = (serviceType) => {
    const typeLabels = {
      'home': 'ניקיון בית',
      'office': 'ניקיון משרדים',
      'building': 'ניקיון בניינים',
      'airbnb': 'ניקיון אירבנב',
    };
    return typeLabels[serviceType] || 'שירות';
  };
  
  const formatPrice = (price) => {
    return `₪${price.toFixed(2)}`;
  };
  
  const handleCancelBooking = async () => {
    try {
      setIsCancellationDialogVisible(false);
      
      const result = await cancelBooking(bookingId);
      
      if (result.success) {
        setBooking({
          ...booking,
          status: BOOKING_STATUS.CANCELLED,
        });
        
        Alert.alert('ההזמנה בוטלה', 'ההזמנה שלך בוטלה בהצלחה');
      } else {
        Alert.alert('שגיאה', result.message || 'לא ניתן לבטל את ההזמנה');
      }
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בלתי צפויה');
    }
  };
  
  const handleRateService = async () => {
    try {
      setIsRatingDialogVisible(false);
      
      setBooking({
        ...booking,
        rating: {
          value: rating,
          comment: ratingComment,
          date: new Date().toISOString(),
        },
      });
      
      Alert.alert('תודה על הדירוג!', 'הדירוג שלך נשלח בהצלחה');
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לשלוח את הדירוג');
    }
  };
  
  const canBeCancelled = () => {
    if (!booking || booking.status === BOOKING_STATUS.CANCELLED) return false;
    
    const bookingDate = new Date(booking.dateTime);
    const now = new Date();
    const diffTime = bookingDate.getTime() - now.getTime();
    const diffHours = diffTime / (1000 * 60 * 60);
    
    return diffHours >= 24;
  };
  
  const canBeRated = () => {
    return booking && 
           booking.status === BOOKING_STATUS.COMPLETED && 
           !booking.rating;
  };
  
  // ✅ NEW: Vérifier si le service est terminé
  const isServiceTimeEnded = () => {
    if (!booking || !booking.dateTime || !booking.duration) return false;
    
    const startTime = new Date(booking.dateTime);
    const endTime = new Date(startTime.getTime() + booking.duration * 60 * 60 * 1000);
    const now = new Date();
    
    return now > endTime;
  };
  
  // ✅ NEW: Vérifier si on peut compléter manuellement
  const canManuallyComplete = () => {
    return (
      (booking?.status === 'accepted' || 
       booking?.status === 'confirmed' || 
       booking?.status === 'pending') &&
      isServiceTimeEnded()
    );
  };
  
  // ✅ NEW: Complétion manuelle du service
  const handleCompleteService = async () => {
    try {
      setIsCompletionDialogVisible(false);
      
      const result = await updateBookingStatus(bookingId, BOOKING_STATUS.COMPLETED);
      
      if (result.success) {
        setBooking({
          ...booking,
          status: BOOKING_STATUS.COMPLETED,
        });
        
        Alert.alert(
          'השירות הושלם',
          'תודה על האישור!',
          [{ text: 'אישור' }]
        );
        
        // Optionnel : ouvrir le dialog de notation après 1 seconde
        setTimeout(() => {
          setIsRatingDialogVisible(true);
        }, 1000);
      } else {
        Alert.alert('שגיאה', result.message || 'לא ניתן לעדכן את סטטוס ההזמנה');
      }
    } catch (error) {
      console.error('Error completing service:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בלתי צפויה');
    }
  };
  
  const renderRatingStars = () => {
    return (
      <View style={styles.ratingStarsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
          >
            <Icon
              name={rating >= star ? 'star' : 'star-outline'}
              size={32}
              color={rating >= star ? '#FFC107' : '#BDBDBD'}
              style={styles.ratingStar}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const renderExistingRating = () => {
    if (!booking || !booking.rating) return null;
    
    return (
      <Card style={styles.ratingCard}>
        <Card.Content>
          <Text variant="bold" style={[styles.ratingTitle, styles.textRTL]}>הדירוג שלך</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Icon
                key={star}
                name={booking.rating.value >= star ? 'star' : 'star-outline'}
                size={20}
                color={booking.rating.value >= star ? '#FFC107' : '#BDBDBD'}
                style={styles.existingRatingStar}
              />
            ))}
            <Text style={styles.ratingDate}>
              {format(new Date(booking.rating.date), 'P', { locale: he })}
            </Text>
          </View>
          {booking.rating.comment && (
            <Text style={[styles.ratingComment, styles.textRTL]}>
              "{booking.rating.comment}"
            </Text>
          )}
        </Card.Content>
      </Card>
    );
  };
  
  if (isLoading || !booking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }
  
  const serviceColor = getServiceColor(booking.serviceType);
  
  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: serviceColor }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="white" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 16 }}>
          <Text variant="bold" style={{ color: 'white', fontSize: 20 }}>
            פרטי הזמנה
          </Text>
        </View>
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView}>
        <View style={[styles.statusBanner, { backgroundColor: BOOKING_STATUS_COLORS[booking.status] }]}>
          <Text style={styles.statusText}>
            {getBookingStatusLabel(booking.status)}
          </Text>
        </View>
        
        <Card style={styles.mainCard}>
          <Card.Content>
            <View style={[styles.dateSection, styles.rtlRow]}>
              <Icon name="calendar" size={24} color={serviceColor} style={styles.iconRTL} />
              <View>
                <Text style={[styles.dateText, styles.textRTL]}>
                  {formatBookingDate(booking.dateTime)}
                </Text>
                <Text style={[styles.timeText, styles.textRTL]}>
                  {formatBookingTime(booking.dateTime)}
                </Text>
              </View>
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.serviceSection}>
              <View style={[styles.serviceRow, styles.rtlRow]}>
                <Text style={[styles.label, styles.textRTL]}>סוג שירות</Text>
                <View style={[styles.serviceTypeBadge, { backgroundColor: serviceColor }]}>
                  <Text style={styles.serviceTypeText}>
                    {getServiceTypeLabel(booking.serviceType)}
                  </Text>
                </View>
              </View>
              
              <View style={[styles.detailRow, styles.rtlRow]}>
                <Text style={[styles.label, styles.textRTL]}>משך</Text>
                <Text style={[styles.value, styles.textRTL]}>
                  {booking.duration} שעות
                </Text>
              </View>
              
              <View style={[styles.detailRow, styles.rtlRow]}>
                <Text style={[styles.label, styles.textRTL]}>מחיר</Text>
                <Text style={[styles.value, styles.priceValue, styles.textRTL]}>
                  {formatPrice(booking.price)}
                </Text>
              </View>
            </View>
            
            <Divider style={styles.divider} />
            
            {/* ✅ ESCROW - Section Provider avec affichage conditionnel du téléphone */}
            <View style={styles.providerSection}>
              <Text variant="bold" style={[styles.sectionTitle, styles.textRTL]}>
                ספק השירות
              </Text>
              
              {/* ✅ ESCROW - Si providerPhoneVisible === true */}
              {booking.providerPhoneVisible ? (
                <>
                  <View style={[styles.providerInfo, styles.rtlRow]}>
                    <Avatar.Text 
                      size={40} 
                      label={booking.selectedProvider?.name?.charAt(0) || 'P'} 
                      style={{ backgroundColor: serviceColor }}
                    />
                    <View style={[styles.providerDetails, styles.rtlFlex]}>
                      <Text style={[styles.providerName, styles.textRTL]}>
                        {booking.selectedProvider?.name || 'ספק לא שויך'}
                      </Text>
                      {booking.selectedProvider?.rating && (
                        <View style={[styles.providerRating, styles.rtlRow]}>
                          <Icon name="star" size={16} color="#FFC107" />
                          <Text style={[styles.ratingText, styles.textRTL]}>
                            {booking.selectedProvider.rating}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {/* Téléphone visible - APPROUVÉ */}
                  <View style={[styles.phoneContainer, styles.rtlRow]}>
                    <Icon name="check-circle" size={20} color="#4CAF50" style={styles.iconRTL} />
                    <View style={styles.phoneDetails}>
                      <Text style={[styles.phoneLabel, styles.textRTL]}>
                        מספר טלפון (אושר)
                      </Text>
                      <TouchableOpacity 
                        style={[styles.phoneButton, styles.rtlRow]}
                        onPress={() => {
                          const phone = booking.selectedProvider?.phone || booking.provider?.phone;
                          if (phone) {
                            Linking.openURL(`tel:${phone}`);
                          }
                        }}
                      >
                        <Icon name="phone" size={18} color="#007AFF" style={styles.iconRTL} />
                        <Text style={[styles.phoneNumber, styles.textRTL]}>
                          {booking.selectedProvider?.phone || booking.provider?.phone}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {/* ✅ ESCROW - Si providerPhoneVisible === false */}
                  <View style={[styles.providerInfo, styles.rtlRow]}>
                    <Avatar.Text 
                      size={40} 
                      label={booking.selectedProvider?.name?.charAt(0) || 'P'} 
                      style={{ backgroundColor: serviceColor }}
                    />
                    <View style={[styles.providerDetails, styles.rtlFlex]}>
                      <Text style={[styles.providerName, styles.textRTL]}>
                        {booking.selectedProvider?.name || 'ספק לא שויך'}
                      </Text>
                      {booking.selectedProvider?.rating && (
                        <View style={[styles.providerRating, styles.rtlRow]}>
                          <Icon name="star" size={16} color="#FFC107" />
                          <Text style={[styles.ratingText, styles.textRTL]}>
                            {booking.selectedProvider.rating}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {/* Téléphone masqué - EN ATTENTE */}
                  <View style={[styles.phoneContainer, styles.phoneHiddenContainer, styles.rtlRow]}>
                    <Icon name="lock" size={20} color="#FF9800" style={styles.iconRTL} />
                    <View style={styles.phoneDetails}>
                      <Text style={[styles.phoneLabel, styles.textRTL]}>
                        מספר טלפון
                      </Text>
                      <Text style={[styles.phoneHidden, styles.textRTL]}>
                        ●●● ●●● ●●●●
                      </Text>
                      <Text style={[styles.phoneHiddenNote, styles.textRTL]}>
                        {booking.status === BOOKING_STATUS.PENDING_PAYMENT || booking.status === BOOKING_STATUS.PENDING 
                          ? '⏳ ממתין לאישור הספק - הכסף שלך מוחזק בנאמנות'
                          : booking.status === BOOKING_STATUS.DECLINED
                          ? '❌ הבקשה נדחתה - תקבל החזר כספי מלא'
                          : 'לא זמין'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
            
            <Divider style={styles.divider} />
            
            {/* ✅ ESCROW - Afficher info de paiement si applicable */}
            {booking.payment && (
              <>
                <View style={[styles.paymentStatusContainer, styles.rtlRow]}>
                  <Icon 
                    name={
                      booking.payment.status === 'held' ? 'clock-outline' :
                      booking.payment.status === 'captured' ? 'check-circle' :
                      booking.payment.status === 'refunded' ? 'undo' :
                      'information'
                    } 
                    size={18} 
                    color={
                      booking.payment.status === 'held' ? '#FF9800' :
                      booking.payment.status === 'captured' ? '#4CAF50' :
                      booking.payment.status === 'refunded' ? '#F44336' :
                      '#666'
                    }
                    style={styles.iconRTL}
                  />
                  <View style={styles.paymentDetails}>
                    <Text style={[styles.paymentLabel, styles.textRTL]}>
                      סטטוס תשלום
                    </Text>
                    <Text style={[styles.paymentStatusText, styles.textRTL]}>
                      {booking.payment.status === 'held' && `${booking.payment.amount}₪ מוחזק בנאמנות`}
                      {booking.payment.status === 'captured' && `${booking.payment.amount}₪ נלקח בהצלחה`}
                      {booking.payment.status === 'refunded' && `${booking.payment.amount}₪ הוחזר`}
                    </Text>
                  </View>
                </View>
                <Divider style={styles.divider} />
              </>
            )}
            
            {/* כתובת השירות */}
            <View style={styles.addressSection}>
              <View style={[styles.addressHeader, styles.rtlRow]}>
                <Text variant="bold" style={[styles.sectionTitle, styles.textRTL]}>
                  כתובת השירות
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('AddressSelection')}>
                  <Text style={[styles.modifyButton, { color: serviceColor }, styles.textRTL]}>
                    שנה
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.addressInfo, styles.rtlRow]}>
                <Icon 
                  name="map-marker" 
                  size={24} 
                  color={serviceColor} 
                  style={styles.iconRTL} 
                />
                <View style={[styles.addressDetails, styles.rtlFlex]}>
                  <Text style={[styles.addressText, styles.textRTL]}>
                    {displayAddress}
                  </Text>
                  {currentBooking?.address && (
                    <Text style={[styles.addressSource, styles.textRTL]}>
                      כתובת מותאמת אישית
                    </Text>
                  )}
                  {!currentBooking?.address && (
                    <Text style={[styles.addressSource, styles.textRTL]}>
                      כתובת מהרישום
                    </Text>
                  )}
                </View>
              </View>
            </View>
            
            {booking.notes && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.notesSection}>
                  <Text variant="bold" style={[styles.sectionTitle, styles.textRTL]}>
                    הוראות מיוחדות
                  </Text>
                  <View style={[styles.notesBox, styles.rtlRow]}>
                    <Icon 
                      name="note-text" 
                      size={24} 
                      color={serviceColor} 
                      style={styles.iconRTL} 
                    />
                    <Text style={[styles.notesText, styles.textRTL]}>
                      {booking.notes}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </Card.Content>
        </Card>
        
        {renderExistingRating()}
        
        <View style={styles.actionsContainer}>
          {/* ✅ NEW: Bouton de complétion manuelle */}
          {canManuallyComplete() && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.containedButton, { backgroundColor: '#9C27B0' }]}
              onPress={() => setIsCompletionDialogVisible(true)}
            >
              <Icon name="check-circle" size={20} color="white" style={{ marginLeft: 8 }} />
              <Text style={[styles.buttonText, { color: 'white' }]}>סיים שירות</Text>
            </TouchableOpacity>
          )}
          
          {canBeRated() && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.containedButton, { backgroundColor: '#9C27B0' }]}
              onPress={() => setIsRatingDialogVisible(true)}
            >
              <Icon name="star" size={20} color="white" style={{ marginLeft: 8 }} />
              <Text style={[styles.buttonText, { color: 'white' }]}>דרג את השירות</Text>
            </TouchableOpacity>
          )}
          
          {canBeCancelled() && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.outlinedButton, { borderColor: '#F44336' }]}
              onPress={() => setIsCancellationDialogVisible(true)}
            >
              <Icon name="close-circle" size={20} color="#F44336" style={{ marginLeft: 8 }} />
              <Text style={[styles.buttonText, { color: '#F44336' }]}>בטל הזמנה</Text>
            </TouchableOpacity>
          )}
          
          {booking.status === BOOKING_STATUS.CONFIRMED && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.outlinedButton, { borderColor: serviceColor }]}
              onPress={() => { /* ניווט למסך שינוי */ }}
            >
              <Icon name="calendar-edit" size={20} color={serviceColor} style={{ marginLeft: 8 }} />
              <Text style={[styles.buttonText, { color: serviceColor }]}>שנה הזמנה</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.textButton]}
            onPress={() => { /* ניווט לעזרה */ }}
          >
            <Icon name="help-circle" size={20} color={theme.colors.primary} style={{ marginLeft: 8 }} />
            <Text style={[styles.buttonText, { color: theme.colors.primary }]}>צריך עזרה?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* ✅ NEW: דיאלוג סיום שירות */}
      <Portal>
        <Dialog
          visible={isCompletionDialogVisible}
          onDismiss={() => setIsCompletionDialogVisible(false)}
          style={styles.dialog}
        >
          <View style={{ padding: 20, paddingBottom: 0 }}>
            <Text variant="bold" style={[styles.textRTL, { fontSize: 20, marginBottom: 8 }]}>
              סיום שירות
            </Text>
          </View>
          <Dialog.Content>
            <Text style={[styles.dialogText, styles.textRTL]}>
              האם השירות הושלם בהצלחה?
            </Text>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <TouchableOpacity 
              style={styles.dialogButton}
              onPress={() => setIsCompletionDialogVisible(false)}
            >
              <Text style={[styles.buttonText, { color: theme.colors.primary }]}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.dialogButton}
              onPress={handleCompleteService}
            >
              <Text style={[styles.buttonText, { color: '#9C27B0' }]}>כן, סיים</Text>
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
      
      {/* דיאלוג דירוג */}
      <Portal>
        <Dialog
          visible={isRatingDialogVisible}
          onDismiss={() => setIsRatingDialogVisible(false)}
          style={styles.dialog}
        >
          <View style={{ padding: 20, paddingBottom: 0 }}>
            <Text variant="bold" style={[styles.textRTL, { fontSize: 20, marginBottom: 8 }]}>
              דרג את השירות
            </Text>
          </View>
          <Dialog.Content>
            <Text style={[styles.dialogText, styles.textRTL]}>
              איך היה השירות של {booking?.selectedProvider?.name || 'הספק'}?
            </Text>
            {renderRatingStars()}
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.textRTL, { marginBottom: 5, color: '#666' }]}>
                הערות (אופציונלי)
              </Text>
              <RNTextInput
                value={ratingComment}
                onChangeText={setRatingComment}
                style={[styles.commentInput, styles.textRTL, { 
                  borderWidth: 1, 
                  borderColor: '#ddd', 
                  borderRadius: 4,
                  padding: 10,
                  minHeight: 80,
                  textAlign: 'right'
                }]}
                multiline
                numberOfLines={3}
                placeholder="הוסף הערות כאן..."
                placeholderTextColor="#999"
              />
            </View>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <TouchableOpacity 
              style={styles.dialogButton}
              onPress={() => setIsRatingDialogVisible(false)}
            >
              <Text style={[styles.buttonText, { color: theme.colors.primary }]}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dialogButton, { opacity: rating === 0 ? 0.5 : 1 }]}
              onPress={handleRateService} 
              disabled={rating === 0}
            >
              <Text style={[styles.buttonText, { color: '#9C27B0' }]}>שלח דירוג</Text>
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
      
      {/* דיאלוג ביטול */}
      <Portal>
        <Dialog
          visible={isCancellationDialogVisible}
          onDismiss={() => setIsCancellationDialogVisible(false)}
          style={styles.dialog}
        >
          <View style={{ padding: 20, paddingBottom: 0 }}>
            <Text variant="bold" style={[styles.textRTL, { fontSize: 20, marginBottom: 8 }]}>
              ביטול הזמנה
            </Text>
          </View>
          <Dialog.Content>
            <Text style={[styles.dialogText, styles.textRTL]}>
              האם אתה בטוח שברצונך לבטל את ההזמנה?
            </Text>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <TouchableOpacity 
              style={styles.dialogButton}
              onPress={() => setIsCancellationDialogVisible(false)}
            >
              <Text style={[styles.buttonText, { color: theme.colors.primary }]}>לא</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.dialogButton}
              onPress={handleCancelBooking}
            >
              <Text style={[styles.buttonText, { color: '#F44336' }]}>כן, בטל</Text>
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  statusBanner: {
    padding: 10,
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  mainCard: {
    margin: 15,
    borderRadius: 8,
    elevation: 4,
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  icon: {
    marginRight: 10,
  },
  iconRTL: {
    marginRight: 0,
    marginLeft: 10,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 16,
    color: '#666',
  },
  divider: {
    height: 1,
    marginVertical: 15,
  },
  serviceSection: {
    marginBottom: 5,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  serviceTypeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    color: '#555',
  },
  value: {
    fontSize: 16,
  },
  priceValue: {
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  providerSection: {
    marginBottom: 5,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  providerDetails: {
    flex: 1,
    marginLeft: 10,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  providerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  ratingText: {
    marginLeft: 5,
    color: '#666',
  },
  // ✅ ESCROW - Styles téléphone
  phoneContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
  },
  phoneHiddenContainer: {
    backgroundColor: '#FFF8E1',
  },
  phoneDetails: {
    flex: 1,
  },
  phoneLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  phoneButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#BBDEFB',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 6,
  },
  phoneHidden: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 2,
  },
  phoneHiddenNote: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 6,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  // ✅ ESCROW - Styles payment status
  paymentStatusContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 5,
  },
  paymentDetails: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  paymentStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  addressSection: {
    marginBottom: 5,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modifyButton: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  addressInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  addressDetails: {
    flex: 1,
  },
  addressText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  addressSource: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  notesSection: {
    marginBottom: 5,
  },
  notesBox: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  actionsContainer: {
    padding: 15,
    marginBottom: 20,
  },
  actionButton: {
    marginBottom: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  containedButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  outlinedButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  textButton: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    padding: 8,
    paddingTop: 0,
  },
  dialogButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
  },
  ratingCard: {
    margin: 15,
    marginTop: 5,
    borderRadius: 8,
    elevation: 4,
    backgroundColor: '#FFF8E1',
  },
  ratingTitle: {
    fontSize: 16,
    marginBottom: 5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  existingRatingStar: {
    marginRight: 2,
  },
  ratingDate: {
    marginLeft: 10,
    fontSize: 12,
    color: '#666',
  },
  ratingComment: {
    fontStyle: 'italic',
    fontSize: 14,
  },
  dialog: {
    borderRadius: 8,
  },
  dialogText: {
    marginBottom: 15,
  },
  ratingStarsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 15,
  },
  ratingStar: {
    marginHorizontal: 5,
  },
  commentInput: {
    backgroundColor: 'transparent',
    marginTop: 10,
  },
  // סגנונות RTL
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlFlex: {
    marginLeft: 0,
    marginRight: 10,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default BookingDetailsScreen;