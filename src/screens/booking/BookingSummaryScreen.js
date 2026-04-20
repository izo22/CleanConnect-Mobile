// src/screens/booking/BookingSummaryScreen.js
// ✅ VERSION AVEC FOND DYNAMIQUE PAR TYPE DE SERVICE

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY_LABELS, calculatePlatformFees, getServiceColor, getServiceBackgroundColor } from '../../config/constants';
import PriceBreakdown from '../../components/PriceBreakdown';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';

const BookingSummaryScreen = ({ navigation }) => {
  const theme = useTheme();
  const { currentBooking, calculatePrice, updateBooking, createBooking } = useBooking();
  const { userInfo } = useAuth();
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const isRTL = true;
  
  const serviceColor = getServiceColor(currentBooking.serviceType);
  const serviceBgColor = getServiceBackgroundColor(currentBooking.serviceType); // ✅ FOND DYNAMIQUE
  
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
        <View style={[styles.mediaPreviewInfo, styles.rtlRow]}>
          <Icon 
            name={mediaItem.type === 'video' ? 'video' : 'image'} 
            size={12} 
            color="#9CA3AF"
          />
          <Text style={[styles.mediaPreviewSize, styles.textRTL]}>
            {formatFileSize(mediaItem.size)}
          </Text>
        </View>
      </View>
    );
  };
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: serviceBgColor }]}>
      {/* HEADER MINIMALISTE BLANC */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-forward" size={20} color="#1F2937" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.textRTL]}>סיכום ההזמנה</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={[styles.headerSubtitle, styles.textRTL]}>בדוק את הפרטים לפני שממשיך</Text>
      </View>
      
      {/* CARD ULTRA-MINIMALISTE */}
      <View style={styles.summaryCard}>
        {/* Service Badge */}
        <View style={[styles.serviceBadge, { backgroundColor: `${serviceColor}10` }]}>
          <Icon name="broom" size={14} color={serviceColor} />
          <Text style={[styles.serviceBadgeText, { color: serviceColor }, styles.textRTL]}>
            {SERVICE_TYPE_LABELS[currentBooking.serviceType] || 'לא נבחר'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, styles.textRTL]}>פרטי שירות</Text>
          <View style={[styles.infoRow, styles.rtlRow]}>
            <Icon name="clock-outline" size={18} color="#9CA3AF" style={styles.iconRTL} />
            <Text style={[styles.infoText, styles.textRTL]}>
              {currentBooking.duration}h • {CLEANING_FREQUENCY_LABELS[currentBooking.frequency]}
            </Text>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, styles.textRTL]}>תאריך ושעה</Text>
          {currentBooking.dateTime ? (
            <>
              <View style={[styles.infoRow, styles.rtlRow]}>
                <Icon name="calendar-blank-outline" size={18} color="#9CA3AF" style={styles.iconRTL} />
                <Text style={[styles.infoText, styles.textRTL]}>
                  {formatDate(currentBooking.dateTime)}
                </Text>
              </View>
              <View style={[styles.infoRow, styles.rtlRow, { marginTop: 8 }]}>
                <Icon name="clock-outline" size={18} color="#9CA3AF" style={styles.iconRTL} />
                <Text style={[styles.infoText, styles.textRTL]}>
                  {formatTime(currentBooking.dateTime)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={[styles.missingText, styles.textRTL]}>תאריך ושעה לא נבחרו</Text>
          )}
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, styles.textRTL]}>ספק שירות</Text>
          {currentBooking.selectedProvider ? (
            <View style={[styles.infoRow, styles.rtlRow]}>
              <Icon name="account-outline" size={18} color="#9CA3AF" style={styles.iconRTL} />
              <Text style={[styles.infoText, styles.textRTL]}>
                {currentBooking.selectedProvider.name}
              </Text>
            </View>
          ) : (
            <Text style={[styles.missingText, styles.textRTL]}>ספק שירות לא נבחר</Text>
          )}
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, styles.textRTL]}>כתובת</Text>
          {currentBooking.address ? (
            <>
              <View style={[styles.infoRow, styles.rtlRow]}>
                <Icon name="map-marker-outline" size={18} color="#9CA3AF" style={styles.iconRTL} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoText, styles.textRTL]}>
                    {currentBooking.address.name || 'הכתובת שלי'}
                  </Text>
                  <Text style={[styles.infoSubtext, styles.textRTL]}>
                    {currentBooking.address.fullAddress}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.textButton, styles.rtlRow]}
                onPress={handleAddAddress}
              >
                <Icon name="pencil-outline" size={14} color={serviceColor} style={styles.iconRTL} />
                <Text style={[styles.textButtonText, { color: serviceColor }]}>
                  שנה כתובת
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={[styles.outlinedButton, { borderColor: serviceColor }]}
              onPress={handleAddAddress}
            >
              <Text style={[styles.outlinedButtonText, { color: serviceColor }]}>
                הוסף כתובת
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, styles.textRTL]}>הוראות מיוחדות</Text>
          {currentBooking.notes ? (
            <>
              <View style={[styles.infoRow, styles.rtlRow]}>
                <Icon name="note-text-outline" size={18} color="#9CA3AF" style={styles.iconRTL} />
                <Text style={[styles.infoText, styles.textRTL]}>
                  {currentBooking.notes}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.textButton, styles.rtlRow]}
                onPress={handleAddNotes}
              >
                <Icon name="pencil-outline" size={14} color={serviceColor} style={styles.iconRTL} />
                <Text style={[styles.textButtonText, { color: serviceColor }]}>
                  ערוך הוראות
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={[styles.outlinedButton, { borderColor: serviceColor }]}
              onPress={handleAddNotes}
            >
              <Text style={[styles.outlinedButtonText, { color: serviceColor }]}>
                הוסף הוראות
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {currentBooking.media && currentBooking.media.length > 0 && (
          <>
            <View style={styles.divider} />
            
            <View style={styles.section}>
              <View style={[styles.mediaHeader, styles.rtlRow]}>
                <Text style={[styles.sectionLabel, styles.textRTL]}>תמונות וסרטונים</Text>
                <TouchableOpacity onPress={handleAddNotes}>
                  <Icon name="pencil-outline" size={16} color={serviceColor} />
                </TouchableOpacity>
              </View>
              
              <View style={[styles.mediaGrid, styles.rtlRow]}>
                {currentBooking.media.map((mediaItem, index) => 
                  renderMediaPreview(mediaItem, index)
                )}
              </View>
              
              <View style={[styles.mediaCountBadge, { backgroundColor: `${serviceColor}10` }]}>
                <Icon name="attachment" size={12} color={serviceColor} />
                <Text style={[styles.mediaCountText, { color: serviceColor }, styles.textRTL]}>
                  {currentBooking.media.length} {currentBooking.media.length > 1 ? 'קבצים' : 'קובץ'}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
      
      {isCalculatingPrice ? (
        <View style={styles.loadingPrice}>
          <Text style={[styles.loadingText, styles.textRTL]}>מחשב מחיר...</Text>
        </View>
      ) : (
        <View style={styles.priceContainer}>
          <PriceBreakdown 
            servicePrice={currentBooking.price}
            serviceType={currentBooking.serviceType}
            serviceColor={serviceColor}
            showDetails={true}
            isPromo={false}
          />
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: serviceColor },
            (!isBookingComplete() || isCreatingBooking || isCalculatingPrice) && styles.buttonDisabled
          ]}
          onPress={handleSubmitRequest}
          disabled={!isBookingComplete() || isCreatingBooking || isCalculatingPrice}
        >
          <Text style={[styles.primaryButtonText, styles.textRTL]}>
            המשך לתשלום
          </Text>
        </TouchableOpacity>
        
        {!isBookingComplete() && (
          <Text style={[styles.errorText, styles.textRTL]}>
            אנא השלם את כל המידע הנדרש
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor sera appliquée dynamiquement
  },
  
  // HEADER MINIMALISTE BLANC
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
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#9CA3AF',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  
  // CARD ULTRA-MINIMALISTE
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  
  serviceBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 24,
  },
  serviceBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: 6,
    letterSpacing: -0.2,
  },
  
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1F2937',
    lineHeight: 20,
    flex: 1,
    letterSpacing: -0.2,
  },
  infoSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 4,
    letterSpacing: -0.2,
  },
  missingText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#D1D5DB',
    fontStyle: 'italic',
    letterSpacing: -0.2,
  },
  
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 20,
  },
  
  // BOUTONS MINIMALISTES
  outlinedButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  outlinedButtonText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  
  textButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  textButtonText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  
  // MEDIA
  mediaHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mediaGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  mediaPreviewItem: {
    width: '31%',
    marginHorizontal: '1%',
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  mediaPreviewInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 6,
    backgroundColor: '#FFFFFF',
  },
  mediaPreviewSize: {
    fontSize: 10,
    color: '#9CA3AF',
    marginRight: 4,
    fontWeight: '400',
  },
  mediaCountBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 8,
  },
  mediaCountText: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: 6,
    letterSpacing: -0.2,
  },
  
  // PRIX
  priceContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  loadingPrice: {
    alignItems: 'center',
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  
  // BOUTON PRINCIPAL
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  primaryButton: {
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '400',
  },
  
  // RTL
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  iconRTL: {
    marginLeft: 10,
    marginRight: 0,
  },
});

export default BookingSummaryScreen;