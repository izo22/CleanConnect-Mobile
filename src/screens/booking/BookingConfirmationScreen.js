// src/screens/booking/BookingConfirmationScreen.js
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Title, Button, Divider, List, Avatar, useTheme, ActivityIndicator } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY_LABELS } from '../../config/constants';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BookingConfirmationScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const { userBookings, fetchUserBookings, addBooking, currentBooking } = useBooking();
  const { bookingId, requestType = 'payment' } = route.params || {};
  
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Charger les détails de la réservation
  useEffect(() => {
    const loadBookingDetails = async () => {
      setIsLoading(true);
      
      try {
        // Récupérer toutes les réservations de l'utilisateur
        await fetchUserBookings();
        
        // Trouver la réservation spécifique par ID
        const foundBooking = userBookings.find(b => b._id === bookingId);
        
        if (foundBooking) {
          setBooking(foundBooking);
        } else {
          // Simuler une réservation pour la démonstration
          // (À remplacer par un appel API spécifique en production)
          setBooking({
            _id: bookingId || 'temp-booking-id',
            serviceType: currentBooking.serviceType || 'home',
            status: requestType === 'pending' ? 'pending' : 'confirmed',
            dateTime: currentBooking.dateTime || new Date().toISOString(),
            duration: currentBooking.duration || 2, // Utilise la durée du contexte actuel
            frequency: currentBooking.frequency || 'one_time',
            price: currentBooking.price || 199.99,
            provider: {
              _id: currentBooking.selectedProvider?._id || 'provider-id',
              name: currentBooking.selectedProvider?.name || 'CleanPro Services',
              rating: currentBooking.selectedProvider?.rating || 4.8,
              phone: '+972 50 123 4567',
            },
            address: currentBooking.address || {
              name: 'Domicile',
              fullAddress: '123 Rue Principale, Tel Aviv',
            }
          });
        }
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    
    loadBookingDetails();
  }, [bookingId, fetchUserBookings, requestType, currentBooking]);
  
  // Déterminer le contenu de l'en-tête en fonction du type de requête
  const getHeaderContent = () => {
    if (requestType === 'pending') {
      return {
        icon: "file-document-outline",
        title: "Demande envoyée",
        subtitle: "Votre demande a été envoyée au prestataire"
      };
    } else {
      return {
        icon: "check-circle",
        title: "Réservation confirmée",
        subtitle: "Votre service a été réservé avec succès"
      };
    }
  };
  
  const headerContent = getHeaderContent();
  
  // Couleur associée au type de service
  const getServiceColor = () => {
    if (!booking) return theme.colors.primary;
    
    switch (booking.serviceType) {
      case 'home':
        return theme.colors.homeService;
      case 'office':
        return theme.colors.officeService;
      case 'building':
        return theme.colors.buildingService;
      default:
        return theme.colors.primary;
    }
  };
  
  const serviceColor = getServiceColor();
  
  // Fonction pour formater la date
  const formatDate = (dateString) => {
    if (!dateString) return 'Non défini';
    
    const date = new Date(dateString);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    
    // Formater date en français
    return date.toLocaleDateString('fr-FR', options);
  };
  
  // Fonction pour formater l'heure
  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };
  
  // Fonction pour formater le prix
  const formatPrice = (price) => {
    return `${price.toFixed(2)} ₪`;
  };
  
  // Handler pour voir les détails de la réservation
  const handleViewBookingDetails = () => {
    navigation.navigate('BookingDetails', { bookingId: booking._id });
  };
  
  // Handler pour retourner à l'accueil
  const handleReturnHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'HomeStack' }],
    });
  };
  
  // Handler pour voir les réservations
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
        <Text style={styles.loadingText}>Chargement des détails de votre réservation...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: serviceColor }]}>
        <Icon name={headerContent.icon} size={60} color="white" style={styles.checkIcon} />
        <Title style={styles.headerTitle}>{headerContent.title}</Title>
        <Text style={styles.headerSubtitle}>{headerContent.subtitle}</Text>
      </View>
      
      <Card style={styles.bookingCard}>
        <Card.Content>
          <View style={styles.bookingNumberContainer}>
            <Text style={styles.bookingNumberLabel}>Numéro de réservation</Text>
            <Text style={styles.bookingNumber}>{booking?._id}</Text>
          </View>
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Détails du service</Title>
          <List.Item
            title={SERVICE_TYPE_LABELS[booking?.serviceType] || 'Service de nettoyage'}
            description={`${booking?.duration}h • ${CLEANING_FREQUENCY_LABELS[booking?.frequency]}`}
            left={props => <List.Icon {...props} icon="broom" color={serviceColor} />}
          />
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Date et heure</Title>
          <List.Item
            title={formatDate(booking?.dateTime)}
            description={formatTime(booking?.dateTime)}
            left={props => <List.Icon {...props} icon="calendar" color={serviceColor} />}
          />
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Prestataire</Title>
          <List.Item
            title={booking?.provider?.name}
            description={`Note: ${booking?.provider?.rating}/5`}
            left={props => (
              <Avatar.Text 
                {...props} 
                size={40} 
                label={booking?.provider?.name?.charAt(0) || 'P'} 
                style={{ backgroundColor: serviceColor }}
              />
            )}
          />
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Lieu du service</Title>
          <List.Item
            title={booking?.address?.name || 'Adresse'}
            description={booking?.address?.fullAddress}
            left={props => <List.Icon {...props} icon="map-marker" color={serviceColor} />}
          />
          
          <Divider style={styles.divider} />
          
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Prix estimé:</Text>
            <Text style={styles.priceValue}>{formatPrice(booking?.price || 0)}</Text>
          </View>
        </Card.Content>
      </Card>
      
      {requestType === 'pending' ? (
        <Card style={styles.instructionsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Informations importantes</Title>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>1</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={styles.instructionTitle}>Attente de confirmation</Text>
                <Text style={styles.instructionText}>
                  Votre demande a été envoyée au prestataire. Il doit confirmer sa disponibilité.
                </Text>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>2</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={styles.instructionTitle}>Notification</Text>
                <Text style={styles.instructionText}>
                  Vous recevrez une notification dès que le prestataire aura répondu à votre demande.
                </Text>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>3</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={styles.instructionTitle}>Suivi</Text>
                <Text style={styles.instructionText}>
                  Vous pouvez suivre l'état de votre demande dans la section "Mes réservations".
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.instructionsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Prochaines étapes</Title>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>1</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={styles.instructionTitle}>Confirmez votre disponibilité</Text>
                <Text style={styles.instructionText}>
                  Assurez-vous d'être disponible à la date et à l'heure prévues. 
                </Text>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>2</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={styles.instructionTitle}>Préparation du lieu</Text>
                <Text style={styles.instructionText}>
                  Facilitez l'accès au prestataire et dégagez les zones à nettoyer.
                </Text>
              </View>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.instructionNumber, { backgroundColor: serviceColor }]}>
                <Text style={styles.instructionNumberText}>3</Text>
              </View>
              <View style={styles.instructionContent}>
                <Text style={styles.instructionTitle}>Service et paiement</Text>
                <Text style={styles.instructionText}>
                  Le prestataire arrivera à l'heure prévue et effectuera le service.
                  {booking?.paymentMethod === 'cash' ? " N'oubliez pas de préparer le paiement en espèces." : ''}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}
      
      <View style={styles.buttonContainer}>
        {requestType === 'pending' ? (
          <Button
            mode="contained"
            style={[styles.button, { backgroundColor: serviceColor }]}
            onPress={handleViewBookings}
          >
            Voir mes réservations
          </Button>
        ) : (
          <Button
            mode="contained"
            style={[styles.button, { backgroundColor: serviceColor }]}
            onPress={handleViewBookingDetails}
          >
            Voir les détails de la réservation
          </Button>
        )}
        
        <Button
          mode="outlined"
          style={[styles.button, styles.secondaryButton]}
          onPress={handleReturnHome}
          color={serviceColor}
        >
          Retour à l'accueil
        </Button>
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
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
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
    flexDirection: 'row',
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
  button: {
    paddingVertical: 8,
    marginBottom: 10,
  },
  secondaryButton: {
    borderColor: 'transparent',
  }
});

export default BookingConfirmationScreen;
