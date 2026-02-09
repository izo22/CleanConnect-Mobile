// src/screens/booking/BookingConfirmationScreen.js
// ✅ גרסה מתורגמת לעברית עם תמיכה ב-RTL
// ✅ תוקן: נוסף תמיכה ב-Airbnb עם צבע #FF5A5F
// 🐛 תוקן: החלפת Button ב-TouchableOpacity לפתרון שגיאת labelLarge

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, I18nManager, TouchableOpacity } from 'react-native';
import { Text, Card, Title, Divider, List, Avatar, useTheme, ActivityIndicator } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY_LABELS, getServiceColor } from '../../config/constants';  // ✅ Import getServiceColor
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BookingConfirmationScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const { userBookings, fetchUserBookings, currentBooking } = useBooking();
  const { bookingId, requestType = 'payment' } = route.params || {};
  
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRTL = true; // תמיד RTL לעברית
  
  // טעינת פרטי ההזמנה
  useEffect(() => {
    const loadBookingDetails = async () => {
      setIsLoading(true);
      
      try {
        await fetchUserBookings();
        const foundBooking = userBookings.find(b => b._id === bookingId);
        
        if (foundBooking) {
          setBooking(foundBooking);
        } else {
          // סימולציה של הזמנה להדגמה
          setBooking({
            _id: bookingId || 'temp-booking-id',
            serviceType: currentBooking.serviceType || 'home',
            status: requestType === 'pending' ? 'pending' : 'confirmed',
            dateTime: currentBooking.dateTime || new Date().toISOString(),
            duration: currentBooking.duration || 2,
            frequency: currentBooking.frequency || 'one_time',
            price: currentBooking.price || 199.99,
            provider: {
              _id: currentBooking.selectedProvider?._id || 'provider-id',
              name: currentBooking.selectedProvider?.name || 'CleanPro Services',
              rating: currentBooking.selectedProvider?.rating || 4.8,
              phone: '+972 50 123 4567',
            },
            address: currentBooking.address || {
              name: 'כתובת הבית',
              fullAddress: 'רחוב הראשי 123, תל אביב',
            }
          });
        }
      } catch (error) {
        console.error('שגיאה בטעינת פרטי הזמנה:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadBookingDetails();
  }, [bookingId, fetchUserBookings, requestType, currentBooking]);
  
  // קביעת תוכן הכותרת לפי סוג הבקשה
  const getHeaderContent = () => {
    if (requestType === 'pending') {
      return {
        icon: "file-document-outline",
        title: "בקשה נשלחה",
        subtitle: "בקשתך נשלחה לספק השירות"
      };
    } else {
      return {
        icon: "check-circle",
        title: "ההזמנה אושרה",
        subtitle: "השירות הוזמן בהצלחה"
      };
    }
  };
  
  const headerContent = getHeaderContent();
  
  // ✅ ✅ ✅ COULEUR DYNAMIQUE depuis constants.js
  const serviceColor = getServiceColor(booking?.serviceType || 'home');
  
  // פורמט תאריך
  const formatDate = (dateString) => {
    if (!dateString) return 'לא מוגדר';
    
    const date = new Date(dateString);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('he-IL', options);
  };
  
  // פורמט שעה
  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };
  
  // פורמט מחיר
  const formatPrice = (price) => {
    return `${price.toFixed(2)} ₪`;
  };
  
  // מעבר לפרטי הזמנה
  const handleViewBookingDetails = () => {
    navigation.navigate('BookingDetails', { bookingId: booking._id });
  };
  
  // חזרה לדף הבית
  const handleReturnHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'HomeStack' }],
    });
  };
  
  // צפייה בהזמנות
  const handleViewBookings = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, styles.textRTL]}>טוען את פרטי ההזמנה...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: serviceColor }]}>
        <Icon name={headerContent.icon} size={60} color="white" style={styles.checkIcon} />
        <Title style={[styles.headerTitle, styles.textRTL]}>{headerContent.title}</Title>
        <Text style={[styles.headerSubtitle, styles.textRTL]}>{headerContent.subtitle}</Text>
      </View>
      
      <Card style={styles.bookingCard}>
        <Card.Content>
          <View style={styles.bookingNumberContainer}>
            <Text style={[styles.bookingNumberLabel, styles.textRTL]}>מספר הזמנה</Text>
            <Text style={[styles.bookingNumber, styles.textRTL]}>{booking?._id}</Text>
          </View>
          
          <Divider style={styles.divider} />
          
          <Title style={[styles.sectionTitle, styles.textRTL]}>פרטי השירות</Title>
          <List.Item
            title={SERVICE_TYPE_LABELS[booking?.serviceType] || 'שירות ניקיון'}
            description={`${booking?.duration}h • ${CLEANING_FREQUENCY_LABELS[booking?.frequency]}`}
            left={props => <List.Icon {...props} icon="broom" color={serviceColor} />}
            titleStyle={styles.textRTL}
            descriptionStyle={styles.textRTL}
          />
          
          <Divider style={styles.divider} />
          
          <Title style={[styles.sectionTitle, styles.textRTL]}>תאריך ושעה</Title>
          <List.Item
            title={formatDate(booking?.dateTime)}
            description={formatTime(booking?.dateTime)}
            left={props => <List.Icon {...props} icon="calendar" color={serviceColor} />}
            titleStyle={styles.textRTL}
            descriptionStyle={styles.textRTL}
          />
          
          <Divider style={styles.divider} />
          
          <Title style={[styles.sectionTitle, styles.textRTL]}>ספק השירות</Title>
          <List.Item
            title={booking?.provider?.name}
            description={`דירוג: ${booking?.provider?.rating}/5`}
            left={props => (
              <Avatar.Text 
                {...props} 
                size={40} 
                label={booking?.provider?.name?.charAt(0) || 'P'} 
                style={{ backgroundColor: serviceColor }}
              />
            )}
            titleStyle={styles.textRTL}
            descriptionStyle={styles.textRTL}
          />
          
          <Divider style={styles.divider} />
          
          <Title style={[styles.sectionTitle, styles.textRTL]}>מיקום השירות</Title>
          <List.Item
            title={booking?.address?.name || 'כתובת'}
            description={booking?.address?.fullAddress}
            left={props => <List.Icon {...props} icon="map-marker" color={serviceColor} />}
            titleStyle={styles.textRTL}
            descriptionStyle={styles.textRTL}
          />
          
          <Divider style={styles.divider} />
          
          <View style={[styles.priceContainer, styles.rtlRow]}>
            <Text style={[styles.priceLabel, styles.textRTL]}>מחיר משוער:</Text>
            <Text style={[styles.priceValue, styles.textRTL]}>{formatPrice(booking?.price || 0)}</Text>
          </View>
        </Card.Content>
      </Card>
      
      {requestType === 'pending' ? (
        <Card style={styles.instructionsCard}>
          <Card.Content>
            <Title style={[styles.sectionTitle, styles.textRTL]}>מידע חשוב</Title>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>1</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={[styles.instructionTitle, styles.textRTL]}>ממתין לאישור</Text>
                <Text style={[styles.instructionText, styles.textRTL]}>
                  בקשתך נשלחה לספק השירות. הוא חייב לאשר את זמינותו.
                </Text>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>2</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={[styles.instructionTitle, styles.textRTL]}>התראה</Text>
                <Text style={[styles.instructionText, styles.textRTL]}>
                  תקבל התראה ברגע שספק השירות יגיב לבקשתך.
                </Text>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>3</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={[styles.instructionTitle, styles.textRTL]}>מעקב</Text>
                <Text style={[styles.instructionText, styles.textRTL]}>
                  תוכל לעקוב אחר מצב בקשתך בקטע "ההזמנות שלי".
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.instructionsCard}>
          <Card.Content>
            <Title style={[styles.sectionTitle, styles.textRTL]}>השלבים הבאים</Title>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>1</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={[styles.instructionTitle, styles.textRTL]}>אשר את הזמינות שלך</Text>
                <Text style={[styles.instructionText, styles.textRTL]}>
                  ודא שתהיה זמין בתאריך ובשעה המתוכננים.
                </Text>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>2</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={[styles.instructionTitle, styles.textRTL]}>הכנת המקום</Text>
                <Text style={[styles.instructionText, styles.textRTL]}>
                  הקל על הגישה לספק השירות ופנה את האזורים לניקוי.
                </Text>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>3</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={[styles.instructionTitle, styles.textRTL]}>שירות ותשלום</Text>
                <Text style={[styles.instructionText, styles.textRTL]}>
                  ספק השירות יגיע בשעה המתוכננת ויבצע את השירות.
                  {booking?.paymentMethod === 'cash' ? ' אל תשכח להכין את התשלום במזומן.' : ''}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}
      
      <View style={styles.buttonContainer}>
        {requestType === 'pending' ? (
          <TouchableOpacity
            style={[styles.containedButton, { backgroundColor: serviceColor }]}
            onPress={handleViewBookings}
            activeOpacity={0.8}
          >
            <Text style={styles.containedButtonText}>
              צפה בהזמנות שלי
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.containedButton, { backgroundColor: serviceColor }]}
            onPress={handleViewBookingDetails}
            activeOpacity={0.8}
          >
            <Text style={styles.containedButtonText}>
              צפה בפרטי ההזמנה
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.outlinedButton, { borderColor: serviceColor }]}
          onPress={handleReturnHome}
          activeOpacity={0.8}
        >
          <Text style={[styles.outlinedButtonText, { color: serviceColor }]}>
            חזרה לדף הבית
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  checkIcon: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
    textAlign: 'center',
  },
  bookingCard: {
    margin: 15,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 4,
  },
  bookingNumberContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  bookingNumberLabel: {
    fontSize: 14,
    color: '#666',
  },
  bookingNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionsCard: {
    margin: 15,
    marginTop: 5,
    borderRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 5,
    marginTop: 5,
  },
  divider: {
    height: 1,
    marginVertical: 15,
  },
  instructionItem: {
    flexDirection: 'row-reverse',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
    marginTop: 3,
  },
  instructionNumberText: {
    color: 'white',
    fontWeight: 'bold',
  },
  instructionContent: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  instructionText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  priceContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  buttonContainer: {
    padding: 15,
    marginBottom: 30,
  },
  
  // ✅ Boutons personnalisés
  containedButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    elevation: 2,
  },
  containedButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  outlinedButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  outlinedButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default BookingConfirmationScreen;