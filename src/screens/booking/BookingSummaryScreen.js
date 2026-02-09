// src/screens/booking/BookingSummaryScreen.js
// ✅ VERSION MODERNE - Navigation intégrée dans le header coloré
// ✅ Plus de barre bleue séparée - tout est dans le rectangle vert

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { Text, Card, Title, Paragraph, Divider, List, ActivityIndicator, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY_LABELS, calculatePlatformFees, getServiceColor } from '../../config/constants';
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
  
  // ✅ Pré-remplir automatiquement l'adresse d'inscription du client
  useEffect(() => {
    const initializeAddress = async () => {
      if (!currentBooking.address && userInfo && userInfo.address && userInfo.city) {
        console.log('🏠 Pré-remplissage automatique de l\'adresse d\'inscription');
        
        const defaultAddress = {
          name: 'כתובת ראשית',
          fullAddress: `${userInfo.address}, ${userInfo.city}`,
          street: userInfo.address,
          city: userInfo.city,
          isDefault: true
        };
        
        await updateBooking({ address: defaultAddress });
        console.log('✅ Adresse pré-remplie automatiquement:', defaultAddress);
      }
    };
    
    initializeAddress();
  }, [userInfo]);
  
  // חישוב מחיר בטעינת המסך
  useEffect(() => {
    const getPrice = async () => {
      setIsCalculatingPrice(true);
      await calculatePrice();
      setIsCalculatingPrice(false);
    };
    
    getPrice();
  }, []);
  
  // ✅ פורמט תאריך ידני בעברית
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
      console.error('❌ שגיאה בפורמט תאריך:', error);
      return 'שגיאה בתאריך';
    }
  };
  
  // ✅ פורמט שעה
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
  
  const serviceColor = getServiceColor(currentBooking.serviceType);
  
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
              <Icon name="play-circle" size={30} color="white" />
            </View>
          </View>
        )}
        <View style={[styles.mediaPreviewInfo, styles.rtlRow]}>
          <Icon 
            name={mediaItem.type === 'video' ? 'video' : 'image'} 
            size={14} 
            color={serviceColor}
          />
          <Text style={[styles.mediaPreviewSize, styles.textRTL]}>
            {formatFileSize(mediaItem.size)}
          </Text>
        </View>
      </View>
    );
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
          <Title style={[styles.headerTitle, styles.textRTL]}>סיכום ההזמנה</Title>
          <View style={{ width: 40 }} />
        </View>
        <Text style={[styles.headerSubtitle, styles.textRTL]}>בדוק את הפרטים לפני שממשיך</Text>
      </View>
      
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={[styles.sectionTitle, styles.textRTL]}>שירות</Title>
          <List.Item
            title={SERVICE_TYPE_LABELS[currentBooking.serviceType] || 'לא נבחר'}
            description={`${currentBooking.duration}h | ${CLEANING_FREQUENCY_LABELS[currentBooking.frequency]}`}
            left={props => <List.Icon {...props} icon="broom" color={serviceColor} />}
            titleStyle={styles.textRTL}
            descriptionStyle={styles.textRTL}
          />
          
          <Divider style={styles.divider} />
          
          <Title style={[styles.sectionTitle, styles.textRTL]}>תאריך ושעה</Title>
          {currentBooking.dateTime ? (
            <List.Item
              title={formatDate(currentBooking.dateTime)}
              description={formatTime(currentBooking.dateTime)}
              left={props => <List.Icon {...props} icon="calendar" color={serviceColor} />}
              titleStyle={styles.textRTL}
              descriptionStyle={styles.textRTL}
            />
          ) : (
            <Paragraph style={[styles.missingInfoText, styles.textRTL]}>תאריך ושעה לא נבחרו</Paragraph>
          )}
          
          <Divider style={styles.divider} />
          
          <Title style={[styles.sectionTitle, styles.textRTL]}>ספק שירות</Title>
          {currentBooking.selectedProvider ? (
            <List.Item
              title={currentBooking.selectedProvider.name}
              left={props => <List.Icon {...props} icon="account" color={serviceColor} />}
              titleStyle={styles.textRTL}
            />
          ) : (
            <Paragraph style={[styles.missingInfoText, styles.textRTL]}>ספק שירות לא נבחר</Paragraph>
          )}
          
          <Divider style={styles.divider} />
          
          <Title style={[styles.sectionTitle, styles.textRTL]}>כתובת</Title>
          {currentBooking.address ? (
            <>
              <List.Item
                title={currentBooking.address.name || 'הכתובת שלי'}
                description={currentBooking.address.fullAddress}
                left={props => <List.Icon {...props} icon="map-marker" color={serviceColor} />}
                right={props => <List.Icon {...props} icon="pencil" onPress={handleAddAddress} />}
                titleStyle={styles.textRTL}
                descriptionStyle={styles.textRTL}
              />
              <View style={[styles.addButtonContainer, styles.rtlRow]}>
                <TouchableOpacity 
                  style={styles.textButton}
                  onPress={handleAddAddress}
                >
                  <Icon name="pencil-outline" size={16} color={serviceColor} style={{ marginLeft: 6 }} />
                  <Text style={[styles.textButtonText, { color: serviceColor }]}>
                    שנה או הוסף כתובת אחרת
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={[styles.addButtonContainer, styles.rtlRow]}>
              <TouchableOpacity 
                style={[styles.outlinedButton, { borderColor: serviceColor }]}
                onPress={handleAddAddress}
              >
                <Text style={[styles.outlinedButtonText, { color: serviceColor }]}>
                  הוסף כתובת
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          <Divider style={styles.divider} />
          
          <Title style={[styles.sectionTitle, styles.textRTL]}>הוראות מיוחדות</Title>
          {currentBooking.notes ? (
            <List.Item
              title={currentBooking.notes}
              left={props => <List.Icon {...props} icon="note-text" color={serviceColor} />}
              right={props => <List.Icon {...props} icon="pencil" onPress={handleAddNotes} />}
              titleStyle={styles.textRTL}
            />
          ) : (
            <View style={[styles.addButtonContainer, styles.rtlRow]}>
              <TouchableOpacity 
                style={[styles.outlinedButton, { borderColor: serviceColor }]}
                onPress={handleAddNotes}
              >
                <Text style={[styles.outlinedButtonText, { color: serviceColor }]}>
                  הוסף הוראות
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {currentBooking.media && currentBooking.media.length > 0 && (
            <>
              <Divider style={styles.divider} />
              
              <View style={[styles.mediaSectionHeader, styles.rtlRow]}>
                <Title style={[styles.sectionTitle, styles.textRTL]}>תמונות וסרטונים</Title>
                <TouchableOpacity onPress={handleAddNotes}>
                  <Icon name="pencil" size={20} color={serviceColor} />
                </TouchableOpacity>
              </View>
              
              <View style={[styles.mediaGrid, styles.rtlRow]}>
                {currentBooking.media.map((mediaItem, index) => 
                  renderMediaPreview(mediaItem, index)
                )}
              </View>
              
              <View style={[styles.mediaCountBadge, styles.rtlRow]}>
                <Icon name="attachment" size={16} color={serviceColor} />
                <Text style={[styles.mediaCountText, styles.textRTL]}>
                  {currentBooking.media.length} {currentBooking.media.length > 1 ? 'קבצים מצורפים' : 'קובץ מצורף'}
                </Text>
              </View>
            </>
          )}
        </Card.Content>
      </Card>
      
      {isCalculatingPrice ? (
        <View style={styles.loadingPrice}>
          <ActivityIndicator size="large" color={serviceColor} />
          <Text style={[styles.loadingText, styles.textRTL]}>מחשב עמלות...</Text>
        </View>
      ) : (
        <View style={styles.priceBreakdownContainer}>
          <PriceBreakdown 
            servicePrice={currentBooking.price}
            serviceColor={serviceColor}
            showDetails={true}
            isPromo={false}
          />
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.containedButton,
            { backgroundColor: serviceColor },
            (!isBookingComplete() || isCreatingBooking || isCalculatingPrice) && styles.buttonDisabled
          ]}
          onPress={handleSubmitRequest}
          disabled={!isBookingComplete() || isCreatingBooking || isCalculatingPrice}
        >
          {isCreatingBooking ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.containedButtonText}>
              המשך לתשלום
            </Text>
          )}
        </TouchableOpacity>
        
        {!isBookingComplete() && (
          <Text style={[styles.errorText, styles.textRTL]}>
            אנא השלם את כל המידע הנדרש לפני שממשיך
          </Text>
        )}
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
    paddingBottom: 32,
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
    marginLeft: 12,  // ✅ Ajoute cette ligne

  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 8,  // ✅ Ajoute cette ligne

  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    marginTop: 4,
    textAlign: 'right',
  },
  summaryCard: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 8,
    marginTop: 6,
    fontWeight: '700',
    color: '#1F2937',
  },
  divider: {
    height: 1,
    marginVertical: 16,
    backgroundColor: '#F3F4F6',
  },
  missingInfoText: {
    fontStyle: 'italic',
    color: '#9CA3AF',
    marginRight: 15,
    marginTop: 5,
    fontSize: 14,
  },
  addButtonContainer: {
    marginRight: 15,
    marginTop: 10,
    marginBottom: 5,
  },
  containedButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  containedButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  outlinedButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  outlinedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  textButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  textButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  mediaSectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    marginTop: 10,
    marginBottom: 10,
    marginHorizontal: -5,
  },
  mediaPreviewItem: {
    width: '31%',
    marginHorizontal: '1%',
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    elevation: 2,
  },
  mediaPreviewThumbnail: {
    width: '100%',
    height: 100,
    backgroundColor: '#e0e0e0',
  },
  videoPreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
  },
  videoPreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  mediaPreviewInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 6,
    backgroundColor: 'white',
  },
  mediaPreviewSize: {
    fontSize: 10,
    color: '#666',
    marginRight: 4,
  },
  mediaCountBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  mediaCountText: {
    fontSize: 12,
    color: '#666',
    marginRight: 6,
    fontWeight: '500',
  },
  priceBreakdownContainer: {
    marginHorizontal: 15,
    marginVertical: 10,
  },
  loadingPrice: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'white',
    marginHorizontal: 15,
    borderRadius: 12,
    elevation: 4,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    padding: 15,
    marginBottom: 30,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  textRTL: {
    textAlign: 'right',
  },
});

export default BookingSummaryScreen;