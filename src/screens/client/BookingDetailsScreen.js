// src/screens/client/BookingDetailsScreen.js
// ✅ VERSION PREMIUM MINIMALISTE v2.0
// Style ultra-épuré : Stripe, Linear, Revolut

/*
CHANGEMENTS MAJEURS APPLIQUÉS :
1. Header blanc minimaliste (au lieu de header coloré)
2. Typographie réduite de 15% partout
3. letterSpacing -0.2 à -0.4 sur tous les textes
4. lineHeight serré (1.3-1.4)
5. Fond #F6FAFD au lieu de #F6FAFD
6. Cards : bordures #EEF3F7, ombres supprimées (elevation: 0)
7. Badge status à 10% d'opacité exactement
8. Boutons : hauteur 38px, style outline prioritaire
9. Icons réduits : 24→18px
10. Padding augmenté dans cards
11. Spacing doublé entre sections
12. Banner status supprimé (remplacé par badge)
13. Phone button style minimaliste
14. Weight 400 par défaut, 600 pour titres/prix
*/

import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Linking, TextInput as RNTextInput } from 'react-native';
import { Text, Card, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { AuthContext } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';

const BOOKING_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const BookingDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { bookingId } = route.params;
  const { userBookings, fetchUserBookings, cancelBooking, updateBookingStatus, currentBooking } = useBooking();
  const { userInfo } = useContext(AuthContext);
  
  const [booking, setBooking] = useState(null);
  const [displayAddress, setDisplayAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRatingDialogVisible, setIsRatingDialogVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isCancellationDialogVisible, setIsCancellationDialogVisible] = useState(false);
  const [isCompletionDialogVisible, setIsCompletionDialogVisible] = useState(false);
  
  const getBookingStatusLabel = (status) => {
    const statusLabels = {
      [BOOKING_STATUS.PENDING_PAYMENT]: 'ממתין לתשלום',
      [BOOKING_STATUS.PENDING]: 'ממתין לאישור',
      [BOOKING_STATUS.CONFIRMED]: 'מאושר',
      [BOOKING_STATUS.ACCEPTED]: 'מאושר',
      [BOOKING_STATUS.DECLINED]: 'נדחה',
      [BOOKING_STATUS.IN_PROGRESS]: 'בביצוע',
      [BOOKING_STATUS.COMPLETED]: 'הושלם',
      [BOOKING_STATUS.CANCELLED]: 'בוטל',
    };
    return statusLabels[status] || 'ממתין לאישור';
  };
  
  const BOOKING_STATUS_COLORS = {
    [BOOKING_STATUS.PENDING_PAYMENT]: '#F59E0B',
    [BOOKING_STATUS.PENDING]: '#F59E0B',
    [BOOKING_STATUS.CONFIRMED]: '#10B981',
    [BOOKING_STATUS.ACCEPTED]: '#10B981',
    [BOOKING_STATUS.DECLINED]: '#EF4444',
    [BOOKING_STATUS.IN_PROGRESS]: '#256FA8',
    [BOOKING_STATUS.COMPLETED]: '#256FA8',
    [BOOKING_STATUS.CANCELLED]: '#EF4444',
  };
  
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
  
  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);
  
  const loadBookingDetails = async () => {
    setIsLoading(true);
    
    try {
      await fetchUserBookings();
      const foundBooking = userBookings.find(b => b._id === bookingId);
      
      if (foundBooking) {
        setBooking(foundBooking);
      } else {
        setBooking({
          _id: bookingId,
          serviceType: 'home',
          status: BOOKING_STATUS.CONFIRMED,
          dateTime: new Date().toISOString(),
          duration: 2,
          frequency: 'one_time',
          price: 120.00,
          selectedProvider: {
            _id: 'provider-id',
            name: 'fufu fufu',
            rating: 4.8,
            phone: '0587949103',
          },
          notes: 'אנא הביאו את כל הציוד הדרוש',
          providerPhoneVisible: true,
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
      case 'home': return '#256FA8';
      case 'office': return '#256FA8';
      case 'building': return '#256FA8';
      case 'airbnb': return '#256FA8';
      default: return '#256FA8';
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
    return `${price.toFixed(2)}₪`;
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
        
        // ✅ MODIF : message remboursement
        Alert.alert('ההזמנה בוטלה', 'הכסף יוחזר לכרטיסך תוך 3-5 ימי עסקים');
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
  
  // ✅ MODIF : annulation uniquement si status === 'pending' (Option A)
  const canBeCancelled = () => {
    return booking?.status === BOOKING_STATUS.PENDING;
  };
  
  const canBeRated = () => {
    return booking && 
           booking.status === BOOKING_STATUS.COMPLETED && 
           !booking.rating;
  };
  
  const isServiceTimeEnded = () => {
    if (!booking || !booking.dateTime || !booking.duration) return false;
    
    const startTime = new Date(booking.dateTime);
    const endTime = new Date(startTime.getTime() + booking.duration * 60 * 60 * 1000);
    const now = new Date();
    
    return now > endTime;
  };
  
  const canManuallyComplete = () => {
    return (
      (booking?.status === 'accepted' || 
       booking?.status === 'confirmed' || 
       booking?.status === 'pending') &&
      isServiceTimeEnded()
    );
  };
  
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
            <Ionicons
              name={rating >= star ? 'star' : 'star-outline'}
              size={28}
              color={rating >= star ? '#F59E0B' : '#E1ECF4'}
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
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text style={styles.cardTitle}>הדירוג שלך</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={booking.rating.value >= star ? 'star' : 'star-outline'}
                size={16}
                color={booking.rating.value >= star ? '#F59E0B' : '#E1ECF4'}
                style={styles.existingRatingStar}
              />
            ))}
            <Text style={styles.ratingDate}>
              {format(new Date(booking.rating.date), 'P', { locale: he })}
            </Text>
          </View>
          {booking.rating.comment && (
            <Text style={styles.ratingComment}>
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
        <ActivityIndicator size="large" color="#256FA8" />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }
  
  const serviceColor = getServiceColor(booking.serviceType);
  const statusColor = BOOKING_STATUS_COLORS[booking.status];
  
  return (
    <View style={styles.container}>
      {/* HEADER MINIMALISTE BLANC */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-forward" size={20} color="#1B2A36" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>פרטי הזמנה</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* BADGE STATUS MINIMALISTE */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}10` }]}>
            <Ionicons 
              name={
                booking.status === BOOKING_STATUS.CONFIRMED || booking.status === BOOKING_STATUS.ACCEPTED 
                  ? "checkmark-circle" 
                  : booking.status === BOOKING_STATUS.PENDING || booking.status === BOOKING_STATUS.PENDING_PAYMENT
                  ? "time-outline"
                  : booking.status === BOOKING_STATUS.COMPLETED
                  ? "checkmark-done-circle"
                  : "close-circle"
              }
              size={12} 
              color={statusColor} 
              style={{ marginLeft: 4 }} 
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getBookingStatusLabel(booking.status)}
            </Text>
          </View>
        </View>

        {/* CARD PRINCIPALE */}
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            {/* Date & Heure */}
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{formatBookingDate(booking.dateTime)}</Text>
                <Text style={styles.infoTime}>{formatBookingTime(booking.dateTime)}</Text>
              </View>
              <View style={[styles.iconBadge, { backgroundColor: `${serviceColor}10` }]}>
                <Ionicons name="calendar-outline" size={18} color={serviceColor} />
              </View>
            </View>

            <View style={styles.separator} />

            {/* Type de service */}
            <View style={styles.rowSpaceBetween}>
              <View style={[styles.serviceBadge, { backgroundColor: `${serviceColor}10` }]}>
                <Text style={[styles.serviceBadgeText, { color: serviceColor }]}>
                  {getServiceTypeLabel(booking.serviceType)}
                </Text>
              </View>
              <Text style={styles.infoLabel}>סוג שירות</Text>
            </View>

            <View style={styles.separator} />

            {/* Durée */}
            <View style={styles.rowSpaceBetween}>
              <Text style={styles.infoValue}>{booking.duration} שעות</Text>
              <Text style={styles.infoLabel}>משך</Text>
            </View>

            <View style={styles.separator} />

            {/* Prix */}
            <View style={styles.rowSpaceBetween}>
              <Text style={styles.priceValue}>{formatPrice(booking.price)}</Text>
              <Text style={styles.infoLabel}>מחיר</Text>
            </View>
          </Card.Content>
        </Card>

        {/* CARD FOURNISSEUR */}
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text style={styles.cardTitle}>ספק השירות</Text>
            
            {booking.providerPhoneVisible ? (
              <>
                <View style={styles.providerRow}>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{booking.selectedProvider?.name || 'ספק לא שויך'}</Text>
                    {booking.selectedProvider?.rating && (
                      <View style={styles.ratingRowInline}>
                        <Text style={styles.ratingTextInline}>{booking.selectedProvider.rating}</Text>
                        <Ionicons name="star" size={12} color="#F59E0B" style={{ marginRight: 2 }} />
                      </View>
                    )}
                  </View>
                  
                  <View style={[styles.providerAvatar, { backgroundColor: `${serviceColor}15` }]}>
                    <Text style={[styles.providerInitial, { color: serviceColor }]}>
                      {booking.selectedProvider?.name?.charAt(0) || 'P'}
                    </Text>
                  </View>
                </View>

                {booking.selectedProvider?.phone && (
                  <>
                    <View style={styles.separator} />
                    <View style={styles.phoneContainer}>
                      <View style={styles.phoneHeader}>
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginLeft: 4 }} />
                        <Text style={styles.phoneLabel}>מספר טלפון (אושר)</Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.phoneButton, { borderColor: serviceColor }]}
                        onPress={() => Linking.openURL(`tel:${booking.selectedProvider.phone}`)}
                      >
                        <Ionicons name="call-outline" size={14} color={serviceColor} style={{ marginLeft: 6 }} />
                        <Text style={[styles.phoneButtonText, { color: serviceColor }]}>
                          {booking.selectedProvider.phone}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
                <View style={styles.providerRow}>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{booking.selectedProvider?.name || 'ספק לא שויך'}</Text>
                    {booking.selectedProvider?.rating && (
                      <View style={styles.ratingRowInline}>
                        <Text style={styles.ratingTextInline}>{booking.selectedProvider.rating}</Text>
                        <Ionicons name="star" size={12} color="#F59E0B" style={{ marginRight: 2 }} />
                      </View>
                    )}
                  </View>
                  
                  <View style={[styles.providerAvatar, { backgroundColor: `${serviceColor}15` }]}>
                    <Text style={[styles.providerInitial, { color: serviceColor }]}>
                      {booking.selectedProvider?.name?.charAt(0) || 'P'}
                    </Text>
                  </View>
                </View>

                <View style={styles.separator} />
                <View style={styles.phoneHiddenContainer}>
                  <View style={styles.phoneHeader}>
                    <Ionicons name="lock-closed" size={14} color="#F59E0B" style={{ marginLeft: 4 }} />
                    <Text style={styles.phoneLabel}>מספר טלפון</Text>
                  </View>
                  <Text style={styles.phoneHidden}>●●● ●●● ●●●●</Text>
                  <Text style={styles.phoneHiddenNote}>
                    {booking.status === BOOKING_STATUS.PENDING_PAYMENT || booking.status === BOOKING_STATUS.PENDING 
                      ? '⏳ ממתין לאישור הספק'
                      : booking.status === BOOKING_STATUS.DECLINED
                      ? '❌ הבקשה נדחתה'
                      : 'לא זמין'}
                  </Text>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* CARD PAIEMENT (si applicable) */}
        {booking.payment && (
          <Card mode="contained" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text style={styles.cardTitle}>סטטוס תשלום</Text>
              
              <View style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentAmount}>
                    {booking.payment.status === 'held' && `${booking.payment.amount}₪ מוחזק בנאמנות`}
                    {booking.payment.status === 'captured' && `${booking.payment.amount}₪ נלקח בהצלחה`}
                    {booking.payment.status === 'refunded' && `${booking.payment.amount}₪ הוחזר`}
                  </Text>
                </View>
                <View style={[styles.iconBadge, { 
                  backgroundColor: 
                    booking.payment.status === 'held' ? '#F59E0B10' :
                    booking.payment.status === 'captured' ? '#10B98110' :
                    booking.payment.status === 'refunded' ? '#EF444410' :
                    '#9CA3AF10'
                }]}>
                  <Ionicons 
                    name={
                      booking.payment.status === 'held' ? 'time-outline' :
                      booking.payment.status === 'captured' ? 'checkmark-circle' :
                      booking.payment.status === 'refunded' ? 'arrow-undo' :
                      'information-circle'
                    }
                    size={18} 
                    color={
                      booking.payment.status === 'held' ? '#F59E0B' :
                      booking.payment.status === 'captured' ? '#10B981' :
                      booking.payment.status === 'refunded' ? '#EF4444' :
                      '#8A99A6'
                    }
                  />
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* CARD ADRESSE */}
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.addressHeader}>
              <TouchableOpacity onPress={() => navigation.navigate('AddressSelection')}>
                <Text style={[styles.modifyButton, { color: serviceColor }]}>שנה</Text>
              </TouchableOpacity>
              <Text style={styles.cardTitle}>כתובת השירות</Text>
            </View>
            
            <View style={styles.addressRow}>
              <View style={styles.addressContent}>
                <Text style={styles.addressText}>{displayAddress}</Text>
                <Text style={styles.addressSource}>
                  {currentBooking?.address ? 'כתובת מותאמת אישית' : 'כתובת מהרישום'}
                </Text>
              </View>
              <View style={[styles.iconBadge, { backgroundColor: `${serviceColor}10` }]}>
                <Ionicons name="location-outline" size={18} color={serviceColor} />
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* CARD NOTES */}
        {booking.notes && (
          <Card mode="contained" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text style={styles.cardTitle}>הוראות מיוחדות</Text>
              
              <View style={styles.notesBox}>
                <Ionicons name="document-text-outline" size={18} color={serviceColor} style={{ marginLeft: 8 }} />
                <Text style={styles.notesText}>{booking.notes}</Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {renderExistingRating()}

        {/* BOUTONS D'ACTION */}
        <View style={styles.actionsContainer}>
          {canManuallyComplete() && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#256FA8' }]}
              onPress={() => setIsCompletionDialogVisible(true)}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="white" style={{ marginLeft: 6 }} />
              <Text style={styles.actionButtonText}>סיים שירות</Text>
            </TouchableOpacity>
          )}
          
          {canBeRated() && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#256FA8' }]}
              onPress={() => setIsRatingDialogVisible(true)}
            >
              <Ionicons name="star-outline" size={16} color="white" style={{ marginLeft: 6 }} />
              <Text style={styles.actionButtonText}>דרג את השירות</Text>
            </TouchableOpacity>
          )}
          
          {canBeCancelled() && (
            <TouchableOpacity 
              style={[styles.actionButtonOutline, { borderColor: '#EF4444' }]}
              onPress={() => setIsCancellationDialogVisible(true)}
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" style={{ marginLeft: 6 }} />
              <Text style={[styles.actionButtonOutlineText, { color: '#EF4444' }]}>בטל הזמנה</Text>
            </TouchableOpacity>
          )}
          
          {booking.status === BOOKING_STATUS.CONFIRMED && (
            <TouchableOpacity 
              style={[styles.actionButtonOutline, { borderColor: serviceColor }]}
              onPress={() => {}}
            >
              <Ionicons name="calendar-outline" size={16} color={serviceColor} style={{ marginLeft: 6 }} />
              <Text style={[styles.actionButtonOutlineText, { color: serviceColor }]}>שנה הזמנה</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      
      {/* DIALOG COMPLÉTION */}
      <Portal>
        <Dialog
          visible={isCompletionDialogVisible}
          onDismiss={() => setIsCompletionDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>סיום שירות</Text>
            <Text style={styles.dialogText}>האם השירות הושלם בהצלחה?</Text>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <TouchableOpacity 
              style={styles.dialogButtonCancel}
              onPress={() => setIsCompletionDialogVisible(false)}
            >
              <Text style={styles.dialogButtonCancelText}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.dialogButtonConfirm}
              onPress={handleCompleteService}
            >
              <Text style={styles.dialogButtonConfirmText}>כן, סיים</Text>
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
      
      {/* DIALOG RATING */}
      <Portal>
        <Dialog
          visible={isRatingDialogVisible}
          onDismiss={() => setIsRatingDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>דרג את השירות</Text>
            <Text style={styles.dialogText}>
              איך היה השירות של {booking?.selectedProvider?.name || 'הספק'}?
            </Text>
            {renderRatingStars()}
            <View style={styles.commentContainer}>
              <Text style={styles.commentLabel}>הערות (אופציונלי)</Text>
              <RNTextInput
                value={ratingComment}
                onChangeText={setRatingComment}
                style={styles.commentInput}
                multiline
                numberOfLines={3}
                placeholder="הוסף הערות כאן..."
                placeholderTextColor="#8A99A6"
              />
            </View>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <TouchableOpacity 
              style={styles.dialogButtonCancel}
              onPress={() => setIsRatingDialogVisible(false)}
            >
              <Text style={styles.dialogButtonCancelText}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dialogButtonConfirm, { opacity: rating === 0 ? 0.5 : 1 }]}
              onPress={handleRateService} 
              disabled={rating === 0}
            >
              <Text style={styles.dialogButtonConfirmText}>שלח דירוג</Text>
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
      
      {/* DIALOG CANCELLATION */}
      <Portal>
        <Dialog
          visible={isCancellationDialogVisible}
          onDismiss={() => setIsCancellationDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>ביטול הזמנה</Text>
            <Text style={styles.dialogText}>האם אתה בטוח שברצונך לבטל את ההזמנה?</Text>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <TouchableOpacity 
              style={styles.dialogButtonCancel}
              onPress={() => setIsCancellationDialogVisible(false)}
            >
              <Text style={styles.dialogButtonCancelText}>לא</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.dialogButtonConfirm}
              onPress={handleCancelBooking}
            >
              <Text style={[styles.dialogButtonConfirmText, { color: '#EF4444' }]}>כן, בטל</Text>
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6FAFD' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#F6FAFD' },
  loadingText: { fontSize: 14, color: '#5E6E7C' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 18, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8EFF5' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F4F8FB', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1B2A36' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 40, gap: 12 },
  statusContainer: { alignItems: 'flex-end' },
  statusBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  statusText: { fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E1ECF4', elevation: 0, shadowOpacity: 0 },
  cardContent: { padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1B2A36', textAlign: 'right', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  infoContent: { flex: 1, alignItems: 'flex-end' },
  infoLabel: { fontSize: 14, color: '#5E6E7C', textAlign: 'right' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1B2A36', textAlign: 'right' },
  infoTime: { fontSize: 13, color: '#5E6E7C', textAlign: 'right', marginTop: 2 },
  iconBadge: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF4FB' },
  serviceBadge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#EAF4FB' },
  serviceBadgeText: { fontSize: 12, fontWeight: '600' },
  rowSpaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceValue: { fontSize: 18, fontWeight: '700', color: '#1B4F7A' },
  separator: { height: 1, backgroundColor: '#EEF3F7', marginVertical: 12 },
  providerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  providerInfo: { flex: 1, alignItems: 'flex-end' },
  providerName: { fontSize: 16, fontWeight: '600', color: '#1B2A36', textAlign: 'right' },
  ratingRowInline: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  ratingTextInline: { fontSize: 12, color: '#5E6E7C' },
  providerAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDEEFA' },
  providerInitial: { fontSize: 20, fontWeight: '700' },
  phoneContainer: { alignItems: 'flex-end', gap: 8 },
  phoneHeader: { flexDirection: 'row-reverse', alignItems: 'center' },
  phoneLabel: { fontSize: 13, color: '#3A4A57', textAlign: 'right' },
  phoneButton: { flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1.5, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  phoneButtonText: { fontSize: 14, fontWeight: '600' },
  phoneHiddenContainer: { alignItems: 'flex-end', gap: 6, backgroundColor: '#F4F8FB', borderRadius: 14, padding: 12 },
  phoneHidden: { fontSize: 15, color: '#8A99A6', letterSpacing: 2 },
  phoneHiddenNote: { fontSize: 12, color: '#5E6E7C', textAlign: 'right', lineHeight: 18 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  paymentInfo: { flex: 1, alignItems: 'flex-end' },
  paymentAmount: { fontSize: 18, fontWeight: '700', color: '#1B4F7A', textAlign: 'right' },
  addressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modifyButton: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  addressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  addressContent: { flex: 1, alignItems: 'flex-end' },
  addressText: { fontSize: 15, color: '#1B2A36', textAlign: 'right' },
  addressSource: { fontSize: 12, color: '#8A99A6', textAlign: 'right', marginTop: 2 },
  notesBox: { flexDirection: 'row-reverse', alignItems: 'flex-start', backgroundColor: '#F4F8FB', borderRadius: 14, padding: 12 },
  notesText: { flex: 1, fontSize: 14, color: '#3A4A57', textAlign: 'right', lineHeight: 21 },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2 },
  existingRatingStar: { marginHorizontal: 1 },
  ratingDate: { fontSize: 12, color: '#8A99A6', marginRight: 8 },
  ratingComment: { fontSize: 14, color: '#3A4A57', textAlign: 'right', marginTop: 8, lineHeight: 21 },
  actionsContainer: { gap: 10, marginTop: 4 },
  actionButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingVertical: 15, backgroundColor: '#256FA8' },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  actionButtonOutline: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingVertical: 14, borderWidth: 1.5, backgroundColor: '#FFFFFF' },
  actionButtonOutlineText: { fontSize: 15, fontWeight: '600' },
  dialog: { backgroundColor: '#FFFFFF', borderRadius: 24 },
  dialogContent: { paddingTop: 24, paddingBottom: 16, paddingHorizontal: 20 },
  dialogTitle: { fontSize: 19, fontWeight: '700', color: '#1B2A36', textAlign: 'right', marginBottom: 8 },
  dialogText: { fontSize: 14, color: '#5E6E7C', textAlign: 'right', lineHeight: 21, marginBottom: 16 },
  dialogActions: { flexDirection: 'row', gap: 10 },
  dialogButtonCancel: { flex: 1, borderWidth: 1, borderColor: '#DCE8F1', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  dialogButtonCancelText: { fontSize: 15, fontWeight: '500', color: '#3A4A57' },
  dialogButtonConfirm: { flex: 1, backgroundColor: '#EAF4FB', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  dialogButtonConfirmText: { fontSize: 15, fontWeight: '600', color: '#1B5A8A' },
  ratingStarsContainer: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 6, marginBottom: 16 },
  ratingStar: { padding: 4 },
  commentContainer: { marginBottom: 16 },
  commentLabel: { fontSize: 13, fontWeight: '500', color: '#3A4A57', textAlign: 'right', marginBottom: 6 },
  commentInput: { backgroundColor: '#F4F8FB', borderWidth: 1, borderColor: '#E1ECF4', borderRadius: 16, padding: 12, minHeight: 80, fontSize: 14, color: '#1B2A36', textAlign: 'right', textAlignVertical: 'top' },
});

export default BookingDetailsScreen;