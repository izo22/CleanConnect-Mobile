// src/screens/booking/BookingSummaryScreen.js
// ✅ VERSION AVEC FOND DYNAMIQUE PAR TYPE DE SERVICE
// ✅ REFONTE BLEU CLAIR (maquette 05) : prestataire · date/heure/adresse · notes · prix

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY_LABELS } from '../../config/constants';
import { COLORS } from '../../config/theme';
import { ScreenHeader, PrimaryButton, PhotoOrPlaceholder, TOP_SPACE } from '../../components/BlueUI';
import PriceBreakdown from '../../components/PriceBreakdown';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';

const BookingSummaryScreen = ({ navigation }) => {
  const { currentBooking, calculatePrice, updateBooking, createBooking } = useBooking();
  const { userInfo } = useAuth();
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  
  useEffect(() => {
    const initializeAddress = async () => {
      if (!currentBooking.address && userInfo && userInfo.address && userInfo.city) {
        const defaultAddress = {
          name: 'כתובת ראשית',
          fullAddress: `${userInfo.address}, ${userInfo.city}`,
          street: userInfo.address,
          city: userInfo.city,
          isDefault: true
        };
        
        await updateBooking({ address: defaultAddress });
      }
    };
    
    initializeAddress();
  }, [userInfo]);
  
  useEffect(() => {
    const getPrice = async () => {
      setIsCalculatingPrice(true);
      await calculatePrice();
      setIsCalculatingPrice(false);
    };
    
    getPrice();
  }, []);
  
  const formatDate = (dateString) => {
    if (!dateString) return 'לא מוגדר';
    
    try {
      let date;
      
      if (typeof dateString === 'string' && dateString.includes('T') && !dateString.endsWith('Z')) {
        const [datePart, timePart] = dateString.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        
        date = new Date(year, month - 1, day, hours, minutes, seconds || 0);
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return 'תאריך לא תקין';
      }
      
      const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      const monthNames = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      
      const dayOfWeek = dayNames[date.getDay()];
      const day = date.getDate();
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      
      return `יום ${dayOfWeek}, ${day} ב${month} ${year}`;
    } catch (error) {
      return 'שגיאה בתאריך';
    }
  };
  
  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    try {
      let date;
      
      if (typeof dateString === 'string' && dateString.includes('T') && !dateString.endsWith('Z')) {
        const [datePart, timePart] = dateString.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        
        date = new Date(year, month - 1, day, hours, minutes, seconds || 0);
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${hours}:${minutes}`;
    } catch (error) {
      return '';
    }
  };
  
  const formatPrice = (price) => {
    return `${price.toFixed(2)} ₪`;
  };
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 בתים';
    const k = 1024;
    const sizes = ['בתים', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  const handleAddNotes = () => {
    navigation.navigate('BookingNotes', { notes: currentBooking.notes });
  };
  
  const handleAddAddress = () => {
    navigation.navigate('AddressSelection');
  };
  
  const handleSubmitRequest = async () => {
    if (!isBookingComplete()) {
      Alert.alert(
        "מידע חסר",
        "אנא השלם את כל המידע הנדרש לפני שממשיך",
        [{ text: "אישור" }]
      );
      return;
    }
    
    navigation.navigate('PaymentScreen');
  };
  
  const isBookingComplete = () => {
    return (
      currentBooking.serviceType &&
      currentBooking.selectedProvider &&
      currentBooking.dateTime &&
      currentBooking.address
    );
  };
  
  const renderMediaPreview = (mediaItem, index) => {
    return (
      <View key={mediaItem.id || index} style={styles.mediaPreviewItem}>
        {mediaItem.type === 'image' ? (
          <Image 
            source={{ uri: mediaItem.uri }} 
            style={styles.mediaPreviewThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.videoPreviewContainer}>
            <Video
              source={{ uri: mediaItem.uri }}
              style={styles.mediaPreviewThumbnail}
              resizeMode="cover"
              shouldPlay={false}
            />
            <View style={styles.videoPreviewOverlay}>
              <Icon name="play-circle" size={24} color="white" />
            </View>
          </View>
        )}
        <View style={styles.mediaPreviewInfo}>
          <Icon 
            name={mediaItem.type === 'video' ? 'video' : 'image'} 
            size={12} 
            color={COLORS.textMuted}
          />
          <Text style={[styles.mediaPreviewSize, styles.textRTL]}>
            {formatFileSize(mediaItem.size)}
          </Text>
        </View>
      </View>
    );
  };
  
  const provider = currentBooking.selectedProvider;
  const serviceLabel = SERVICE_TYPE_LABELS[currentBooking.serviceType] || 'לא נבחר';
  const durationLabel = currentBooking.duration === 1 ? 'שעה אחת' : `${currentBooking.duration} שעות`;
  const frequencyLabel = currentBooking.frequency && currentBooking.frequency !== 'one_time'
    ? ` · ${CLEANING_FREQUENCY_LABELS[currentBooking.frequency]}`
    : '';
  const canContinue = isBookingComplete() && !isCreatingBooking && !isCalculatingPrice;

  return (
    <View style={styles.container}>
      <ScreenHeader title="סיכום ההזמנה" onBack={() => navigation.goBack()} style={styles.header} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* PRESTATAIRE */}
        <View style={[styles.card, styles.providerCard]}>
          <View style={styles.avatar}>
            <PhotoOrPlaceholder uri={provider?.profilePicture} iconSize={26} rounded />
          </View>
          <View style={styles.providerInfo}>
            <Text style={[styles.providerName, styles.textRTL]}>
              {provider ? provider.name : 'ספק שירות לא נבחר'}
            </Text>
            <View style={styles.providerMeta}>
              {provider?.rating ? (
                <>
                  <Ionicons name="star" size={13} color={COLORS.star} />
                  <Text style={styles.metaText}>{provider.rating} · </Text>
                </>
              ) : null}
              <Text style={styles.metaText}>{serviceLabel}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('ProviderSearch')} hitSlop={8}>
            <Text style={styles.linkText}>שינוי</Text>
          </TouchableOpacity>
        </View>

        {/* DATE · HEURE · ADRESSE */}
        <View style={[styles.card, styles.detailsCard]}>
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            {currentBooking.dateTime ? (
              <Text style={[styles.detailText, styles.textRTL]}>{formatDate(currentBooking.dateTime)}</Text>
            ) : (
              <Text style={[styles.missingText, styles.textRTL]}>תאריך ושעה לא נבחרו</Text>
            )}
          </View>
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.detailText, styles.textRTL]}>
              {currentBooking.dateTime ? `${formatTime(currentBooking.dateTime)} · ` : ''}{durationLabel}{frequencyLabel}
            </Text>
          </View>
          <TouchableOpacity style={styles.detailRow} onPress={handleAddAddress} activeOpacity={0.7}>
            <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            {currentBooking.address ? (
              <View style={styles.flex}>
                <Text style={[styles.detailText, styles.textRTL]}>{currentBooking.address.fullAddress}</Text>
                {currentBooking.address.name ? (
                  <Text style={[styles.detailSubtext, styles.textRTL]}>{currentBooking.address.name}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.detailText, styles.missingText, styles.textRTL]}>הוסף כתובת</Text>
            )}
            <Text style={styles.linkText}>{currentBooking.address ? 'שינוי' : 'הוספה'}</Text>
          </TouchableOpacity>
        </View>

        {/* NOTES */}
        <Text style={[styles.sectionTitle, styles.textRTL]}>הערות למנקה</Text>
        <TouchableOpacity style={[styles.card, styles.notesCard]} onPress={handleAddNotes} activeOpacity={0.7}>
          {currentBooking.notes ? (
            <Text style={[styles.notesText, styles.textRTL]}>{currentBooking.notes}</Text>
          ) : (
            <Text style={[styles.notesPlaceholder, styles.textRTL]}>למשל: יש חתול בבית, המפתח אצל השכנה…</Text>
          )}

          {currentBooking.media && currentBooking.media.length > 0 && (
            <>
              <View style={styles.mediaGrid}>
                {currentBooking.media.map((mediaItem, index) =>
                  renderMediaPreview(mediaItem, index)
                )}
              </View>
              <View style={styles.mediaCountBadge}>
                <Ionicons name="attach" size={12} color={COLORS.navy} />
                <Text style={styles.mediaCountText}>
                  {currentBooking.media.length} {currentBooking.media.length > 1 ? 'קבצים' : 'קובץ'}
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* PRIX */}
        {isCalculatingPrice ? (
          <View style={styles.loadingPrice}>
            <Text style={styles.loadingText}>מחשב מחיר...</Text>
          </View>
        ) : (
          <PriceBreakdown
            servicePrice={currentBooking.price}
            serviceType={currentBooking.serviceType}
            showDetails={true}
            isPromo={false}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="המשך לתשלום" onPress={handleSubmitRequest} disabled={!canContinue} />
        {!isBookingComplete() ? (
          <Text style={styles.errorText}>אנא השלם את כל המידע הנדרש</Text>
        ) : (
          <View style={styles.secureRow}>
            <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.secureText}>תשלום מאובטח</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.canvas },
  flex: { flex: 1 },
  header: { paddingTop: TOP_SPACE, paddingBottom: 12 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 16, gap: 10 },

  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },

  providerCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  providerInfo: { flex: 1, gap: 2 },
  providerName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  providerMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textMuted },
  linkText: { fontSize: 13, fontWeight: '500', color: COLORS.primary },

  detailsCard: { paddingVertical: 6, paddingHorizontal: 14 },
  detailRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 10 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  detailText: { flex: 1, fontSize: 14, color: COLORS.text },
  detailSubtext: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  missingText: { fontSize: 14, color: COLORS.textHint },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  notesCard: { borderRadius: 16, padding: 12, minHeight: 44, gap: 10 },
  notesText: { fontSize: 13, color: COLORS.text, lineHeight: 19 },
  notesPlaceholder: { fontSize: 13, color: COLORS.textHint },

  // MEDIA
  mediaGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  mediaPreviewItem: {
    width: '31%',
    marginHorizontal: '1%',
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mediaPreviewThumbnail: {
    width: '100%',
    height: 90,
  },
  videoPreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 90,
  },
  videoPreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(14,40,62,0.25)',
  },
  mediaPreviewInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 6,
    backgroundColor: COLORS.surface,
  },
  mediaPreviewSize: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginRight: 4,
  },
  mediaCountBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.tint,
  },
  mediaCountText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.navy,
  },

  // PRIX
  loadingPrice: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 26, gap: 8, backgroundColor: COLORS.canvas },
  secureRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  secureText: { fontSize: 12, color: COLORS.textMuted },
  errorText: { fontSize: 12, color: COLORS.error, textAlign: 'center' },

  // RTL
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default BookingSummaryScreen;
