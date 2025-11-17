// src/screens/client/BookingDetails.js
import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Title, Paragraph, Button, Divider, ActivityIndicator, Appbar, useTheme, Portal, Dialog, TextInput, Avatar, IconButton } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { AuthContext } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'; // ✅ AJOUT useFocusEffect
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Constantes pour les statuts de réservation
const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Labels pour les statuts
const BOOKING_STATUS_LABELS = {
  [BOOKING_STATUS.PENDING]: 'En attente',
  [BOOKING_STATUS.CONFIRMED]: 'Confirmé',
  [BOOKING_STATUS.IN_PROGRESS]: 'En cours',
  [BOOKING_STATUS.COMPLETED]: 'Terminé',
  [BOOKING_STATUS.CANCELLED]: 'Annulé',
};

// Couleurs pour les statuts
const BOOKING_STATUS_COLORS = {
  [BOOKING_STATUS.PENDING]: '#FF9800',
  [BOOKING_STATUS.CONFIRMED]: '#4CAF50',
  [BOOKING_STATUS.IN_PROGRESS]: '#2196F3',
  [BOOKING_STATUS.COMPLETED]: '#9C27B0',
  [BOOKING_STATUS.CANCELLED]: '#F44336',
};

const BookingDetailsScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { bookingId } = route.params;
  const { userBookings, fetchUserBookings, cancelBooking, updateBookingStatus, currentBooking } = useBooking(); // ✅ AJOUT currentBooking
  const { userInfo } = useContext(AuthContext);
  
  const [booking, setBooking] = useState(null);
  const [displayAddress, setDisplayAddress] = useState(''); // ✅ RENOMMÉ pour clarté
  const [isLoading, setIsLoading] = useState(true);
  const [isRatingDialogVisible, setIsRatingDialogVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isCancellationDialogVisible, setIsCancellationDialogVisible] = useState(false);
  
  // ✅ NOUVELLE FONCTION : Déterminer quelle adresse afficher
  const determineDisplayAddress = async () => {
    try {
      // PRIORITÉ 1 : Adresse du currentBooking (si modifiée via AddressSelection)
      if (currentBooking?.address) {
        setDisplayAddress(currentBooking.address.fullAddress);
        return;
      }
      
      // PRIORITÉ 2 : Adresse du booking spécifique
      if (booking?.address) {
        setDisplayAddress(booking.address.fullAddress);
        return;
      }
      
      // PRIORITÉ 3 : Adresse d'inscription (par défaut)
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setDisplayAddress(user.address || 'Adresse non renseignée');
      } else {
        setDisplayAddress('Adresse non disponible');
      }
    } catch (error) {
      setDisplayAddress('Adresse non disponible');
    }
  };
  
  // ✅ RECHARGER L'ADRESSE QUAND ON REVIENT À L'ÉCRAN
  useFocusEffect(
    React.useCallback(() => {
      determineDisplayAddress();
    }, [currentBooking?.address, booking?.address])
  );
  
  // Chargement initial de l'adresse
  useEffect(() => {
    determineDisplayAddress();
  }, []);
  
  // Chargement des détails de la réservation
  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);
  
  const loadBookingDetails = async () => {
    setIsLoading(true);
    
    try {
      // Récupérer toutes les réservations si ce n'est pas déjà fait
      await fetchUserBookings();
      
      // Trouver la réservation spécifique par ID
      const foundBooking = userBookings.find(b => b._id === bookingId);
      
      if (foundBooking) {
        setBooking(foundBooking);
      } else {
        // Si la réservation n'est pas trouvée (pour la démo, créer une fausse)
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
          notes: 'Attention au chat. Produits écologiques préférés.',
          rating: null,
        });
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Impossible de charger les détails de la réservation. Veuillez réessayer.'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Formater la date pour l'affichage
  const formatBookingDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'PPPP', { locale: fr }); // Format long: "lundi 7 janvier 2023"
    } catch (error) {
      return 'Date non disponible';
    }
  };
  
  // Formater l'heure pour l'affichage
  const formatBookingTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'HH:mm');
    } catch (error) {
      return '';
    }
  };
  
  // Couleur associée au type de service
  const getServiceColor = (serviceType) => {
    switch (serviceType) {
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
  
  // Obtenir le type de service en français
  const getServiceTypeLabel = (serviceType) => {
    switch (serviceType) {
      case 'home':
        return 'Domicile';
      case 'office':
        return 'Bureau';
      case 'building':
        return 'Immeuble';
      default:
        return 'Service';
    }
  };
  
  // Formatage du prix
  const formatPrice = (price) => {
    return `${price.toFixed(2)} ₪`;
  };
  
  // Gestion de l'annulation
  const handleCancelBooking = async () => {
    try {
      setIsCancellationDialogVisible(false);
      
      const result = await cancelBooking(bookingId);
      
      if (result.success) {
        // Mise à jour de l'état local
        setBooking({
          ...booking,
          status: BOOKING_STATUS.CANCELLED,
        });
        
        Alert.alert(
          'Annulation confirmée',
          'Votre réservation a été annulée avec succès.'
        );
      } else {
        Alert.alert(
          'Erreur',
          result.message || 'Une erreur est survenue lors de l\'annulation.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Une erreur inattendue est survenue. Veuillez réessayer.'
      );
    }
  };
  
  // Gestion de la notation
  const handleRateService = async () => {
    try {
      setIsRatingDialogVisible(false);
      
      // En situation réelle, appel à l'API pour enregistrer la notation
      
      // Mise à jour de l'état local
      setBooking({
        ...booking,
        rating: {
          value: rating,
          comment: ratingComment,
          date: new Date().toISOString(),
        },
      });
      
      Alert.alert(
        'Merci',
        'Votre évaluation a été enregistrée avec succès.'
      );
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de l\'enregistrement de votre évaluation.'
      );
    }
  };
  
  // Vérifier si la réservation peut être annulée (24h avant)
  const canBeCancelled = () => {
    if (!booking || booking.status === BOOKING_STATUS.CANCELLED) return false;
    
    const bookingDate = new Date(booking.dateTime);
    const now = new Date();
    const diffTime = bookingDate.getTime() - now.getTime();
    const diffHours = diffTime / (1000 * 60 * 60);
    
    return diffHours >= 24;
  };
  
  // Vérifier si le service peut être noté (terminé et pas encore noté)
  const canBeRated = () => {
    return booking && 
           booking.status === BOOKING_STATUS.COMPLETED && 
           !booking.rating;
  };
  
  // Rendu des étoiles de notation
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
  
  // Rendu de l'évaluation existante
  const renderExistingRating = () => {
    if (!booking || !booking.rating) return null;
    
    return (
      <Card style={styles.ratingCard}>
        <Card.Content>
          <Title style={styles.ratingTitle}>Votre évaluation</Title>
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
              {new Date(booking.rating.date).toLocaleDateString('fr-FR')}
            </Text>
          </View>
          {booking.rating.comment && (
            <Paragraph style={styles.ratingComment}>
              "{booking.rating.comment}"
            </Paragraph>
          )}
        </Card.Content>
      </Card>
    );
  };
  
  if (isLoading || !booking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement des détails...</Text>
      </View>
    );
  }
  
  const serviceColor = getServiceColor(booking.serviceType);
  
  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: serviceColor }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="white" />
        <Appbar.Content title="Détails de la réservation" color="white" />
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView}>
        <View style={[styles.statusBanner, { backgroundColor: BOOKING_STATUS_COLORS[booking.status] }]}>
          <Text style={styles.statusText}>
            {BOOKING_STATUS_LABELS[booking.status]}
          </Text>
        </View>
        
        <Card style={styles.mainCard}>
          <Card.Content>
            <View style={styles.dateSection}>
              <Icon name="calendar" size={24} color={serviceColor} style={styles.icon} />
              <View>
                <Text style={styles.dateText}>
                  {formatBookingDate(booking.dateTime)}
                </Text>
                <Text style={styles.timeText}>
                  {formatBookingTime(booking.dateTime)}
                </Text>
              </View>
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.serviceSection}>
              <View style={styles.serviceRow}>
                <Text style={styles.label}>Type de service</Text>
                <View style={[styles.serviceTypeBadge, { backgroundColor: serviceColor }]}>
                  <Text style={styles.serviceTypeText}>
                    {getServiceTypeLabel(booking.serviceType)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.label}>Durée</Text>
                <Text style={styles.value}>{booking.duration} heures</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.label}>Prix</Text>
                <Text style={[styles.value, styles.priceValue]}>
                  {formatPrice(booking.price)}
                </Text>
              </View>
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.providerSection}>
              <Text style={styles.sectionTitle}>Prestataire</Text>
              <View style={styles.providerInfo}>
                <Avatar.Text 
                  size={40} 
                  label={booking.selectedProvider?.name?.charAt(0) || 'P'} 
                  style={{ backgroundColor: serviceColor }}
                />
                <View style={styles.providerDetails}>
                  <Text style={styles.providerName}>
                    {booking.selectedProvider?.name || "Non assigné"}
                  </Text>
                  {booking.selectedProvider?.rating && (
                    <View style={styles.providerRating}>
                      <Icon name="star" size={16} color="#FFC107" />
                      <Text style={styles.ratingText}>
                        {booking.selectedProvider.rating}
                      </Text>
                    </View>
                  )}
                </View>
                <IconButton 
                  icon="phone" 
                  size={24} 
                  color={serviceColor}
                  onPress={() => {/* Intégrer l'action d'appel */}}
                />
              </View>
            </View>
            
            <Divider style={styles.divider} />
            
            {/* ✅ SECTION ADRESSE AVEC MISE À JOUR DYNAMIQUE */}
            <View style={styles.addressSection}>
              <View style={styles.addressHeader}>
                <Text style={styles.sectionTitle}>Adresse du service</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AddressSelection')}>
                  <Text style={[styles.modifyButton, { color: serviceColor }]}>
                    Modifier
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.addressInfo}>
                <Icon name="map-marker" size={24} color={serviceColor} style={styles.icon} />
                <View style={styles.addressDetails}>
                  <Text style={styles.addressText}>
                    {displayAddress}
                  </Text>
                  {/* ✅ INDICATEUR SOURCE DE L'ADRESSE */}
                  {currentBooking?.address && (
                    <Text style={styles.addressSource}>
                      (Adresse personnalisée)
                    </Text>
                  )}
                  {!currentBooking?.address && (
                    <Text style={styles.addressSource}>
                      (Adresse d'inscription)
                    </Text>
                  )}
                </View>
              </View>
            </View>
            
            {booking.notes && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.notesSection}>
                  <Text style={styles.sectionTitle}>Instructions spéciales</Text>
                  <View style={styles.notesBox}>
                    <Icon name="note-text" size={24} color={serviceColor} style={styles.icon} />
                    <Text style={styles.notesText}>{booking.notes}</Text>
                  </View>
                </View>
              </>
            )}
          </Card.Content>
        </Card>
        
        {renderExistingRating()}
        
        <View style={styles.actionsContainer}>
          {canBeRated() && (
            <Button 
              mode="contained" 
              style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
              icon="star"
              onPress={() => setIsRatingDialogVisible(true)}
            >
              Évaluer le service
            </Button>
          )}
          
          {canBeCancelled() && (
            <Button 
              mode="outlined" 
              style={styles.actionButton}
              icon="close-circle"
              color="#F44336"
              onPress={() => setIsCancellationDialogVisible(true)}
            >
              Annuler la réservation
            </Button>
          )}
          
          {booking.status === BOOKING_STATUS.CONFIRMED && (
            <Button 
              mode="outlined" 
              style={styles.actionButton}
              icon="calendar-edit"
              color={serviceColor}
              onPress={() => { /* Naviguer vers l'écran de modification */ }}
            >
              Modifier la réservation
            </Button>
          )}
          
          <Button 
            mode="text" 
            style={styles.actionButton}
            icon="help-circle"
            onPress={() => { /* Naviguer vers l'aide */ }}
          >
            Besoin d'aide?
          </Button>
        </View>
      </ScrollView>
      
      {/* Dialog de notation */}
      <Portal>
        <Dialog
          visible={isRatingDialogVisible}
          onDismiss={() => setIsRatingDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Évaluer le service</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={styles.dialogText}>
              Comment évaluez-vous le service fourni par {booking?.selectedProvider?.name}?
            </Paragraph>
            {renderRatingStars()}
            <TextInput
              label="Commentaire (optionnel)"
              value={ratingComment}
              onChangeText={setRatingComment}
              style={styles.commentInput}
              multiline
              numberOfLines={3}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsRatingDialogVisible(false)}>Annuler</Button>
            <Button 
              onPress={handleRateService} 
              disabled={rating === 0}
              color="#9C27B0"
            >
              Soumettre
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Dialog de confirmation d'annulation */}
      <Portal>
        <Dialog
          visible={isCancellationDialogVisible}
          onDismiss={() => setIsCancellationDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Confirmer l'annulation</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={styles.dialogText}>
              Êtes-vous sûr de vouloir annuler cette réservation?
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsCancellationDialogVisible(false)}>Non</Button>
            <Button 
              onPress={handleCancelBooking}
              color="#F44336"
            >
              Oui, annuler
            </Button>
          </Dialog.Actions>
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
    fontWeight: 'bold',
    marginBottom: 10,
  },
  providerSection: {
    marginBottom: 5,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
  // ✅ NOUVEAU STYLE POUR INDICATEUR SOURCE
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
  }
});

export default BookingDetailsScreen;
