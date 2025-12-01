// src/screens/booking/BookingSummaryScreen.js
// ✅ VERSION AVEC AFFICHAGE DES MÉDIAS (PHOTOS/VIDÉOS)

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { Text, Card, Title, Paragraph, Button, Divider, List, ActivityIndicator, useTheme } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY_LABELS, calculatePlatformFees } from '../../config/constants';
import PriceBreakdown from '../../components/PriceBreakdown';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';

const BookingSummaryScreen = ({ navigation }) => {
  const theme = useTheme();
  const { currentBooking, calculatePrice, updateBooking, createBooking } = useBooking();
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  
  // Effet pour calculer le prix au chargement de l'écran
  useEffect(() => {
    const getPrice = async () => {
      setIsCalculatingPrice(true);
      await calculatePrice();
      setIsCalculatingPrice(false);
    };
    
    getPrice();
  }, []);
  
  // Fonction pour formater la date
  const formatDate = (dateString) => {
    if (!dateString) return 'Non défini';
    
    const date = new Date(dateString);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    
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
  
  // Fonction pour formater la taille de fichier
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  // Couleur associée au type de service
  const getServiceColor = () => {
    switch (currentBooking.serviceType) {
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
  
  // Handler pour l'ajout de notes
  const handleAddNotes = () => {
    navigation.navigate('BookingNotes', { notes: currentBooking.notes });
  };
  
  // Handler pour l'ajout/modification d'adresse
  const handleAddAddress = () => {
    navigation.navigate('AddressSelection');
  };
  
  // ✅ Fonction modifiée pour aller vers l'écran de paiement
  const handleSubmitRequest = async () => {
    if (!isBookingComplete()) {
      Alert.alert(
        "Informations incomplètes",
        "Veuillez compléter toutes les informations requises avant de continuer.",
        [{ text: "OK" }]
      );
      return;
    }
    
    // Navigation vers l'écran de paiement des frais plateforme
    navigation.navigate('PaymentScreen');
  };
  
  // Vérifier si toutes les informations requises sont présentes
  const isBookingComplete = () => {
    return (
      currentBooking.serviceType &&
      currentBooking.selectedProvider &&
      currentBooking.dateTime &&
      currentBooking.address
    );
  };
  
  // ✅ NOUVEAU: Rendu d'un média dans le récapitulatif
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
        <View style={styles.mediaPreviewInfo}>
          <Icon 
            name={mediaItem.type === 'video' ? 'video' : 'image'} 
            size={14} 
            color={serviceColor}
          />
          <Text style={styles.mediaPreviewSize}>
            {formatFileSize(mediaItem.size)}
          </Text>
        </View>
      </View>
    );
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: serviceColor }]}>
        <Title style={styles.headerTitle}>Récapitulatif de votre réservation</Title>
        <Text style={styles.headerSubtitle}>Vérifiez les détails avant de continuer</Text>
      </View>
      
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Service</Title>
          <List.Item
            title={SERVICE_TYPE_LABELS[currentBooking.serviceType] || 'Non sélectionné'}
            description={`${currentBooking.duration}h • ${CLEANING_FREQUENCY_LABELS[currentBooking.frequency]}`}
            left={props => <List.Icon {...props} icon="broom" color={serviceColor} />}
          />
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Date et heure</Title>
          {currentBooking.dateTime ? (
            <List.Item
              title={formatDate(currentBooking.dateTime)}
              description={formatTime(currentBooking.dateTime)}
              left={props => <List.Icon {...props} icon="calendar" color={serviceColor} />}
            />
          ) : (
            <Paragraph style={styles.missingInfoText}>Date et heure non sélectionnées</Paragraph>
          )}
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Prestataire</Title>
          {currentBooking.selectedProvider ? (
            <List.Item
              title={currentBooking.selectedProvider.name}
              description={`Tarif: ${currentBooking.selectedProvider.hourlyRate || currentBooking.selectedProvider.price?.[currentBooking.serviceType] || 85} ₪/heure`}
              left={props => <List.Icon {...props} icon="account" color={serviceColor} />}
            />
          ) : (
            <Paragraph style={styles.missingInfoText}>Prestataire non sélectionné</Paragraph>
          )}
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Adresse</Title>
          {currentBooking.address ? (
            <List.Item
              title={currentBooking.address.name || 'Mon adresse'}
              description={currentBooking.address.fullAddress}
              left={props => <List.Icon {...props} icon="map-marker" color={serviceColor} />}
              right={props => <List.Icon {...props} icon="pencil" onPress={handleAddAddress} />}
            />
          ) : (
            <View style={styles.addButtonContainer}>
              <Button 
                mode="outlined"
                onPress={handleAddAddress}
                style={{ borderColor: serviceColor }}
                color={serviceColor}
              >
                Ajouter une adresse
              </Button>
            </View>
          )}
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Instructions spéciales</Title>
          {currentBooking.notes ? (
            <List.Item
              title={currentBooking.notes}
              left={props => <List.Icon {...props} icon="note-text" color={serviceColor} />}
              right={props => <List.Icon {...props} icon="pencil" onPress={handleAddNotes} />}
            />
          ) : (
            <View style={styles.addButtonContainer}>
              <Button 
                mode="outlined"
                onPress={handleAddNotes}
                style={{ borderColor: serviceColor }}
                color={serviceColor}
              >
                Ajouter des instructions
              </Button>
            </View>
          )}
          
          {/* ✅ NOUVELLE SECTION: Affichage des médias */}
          {currentBooking.media && currentBooking.media.length > 0 && (
            <>
              <Divider style={styles.divider} />
              
              <View style={styles.mediaSectionHeader}>
                <Title style={styles.sectionTitle}>Photos et Vidéos</Title>
                <TouchableOpacity onPress={handleAddNotes}>
                  <Icon name="pencil" size={20} color={serviceColor} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.mediaGrid}>
                {currentBooking.media.map((mediaItem, index) => 
                  renderMediaPreview(mediaItem, index)
                )}
              </View>
              
              <View style={styles.mediaCountBadge}>
                <Icon name="attachment" size={16} color={serviceColor} />
                <Text style={styles.mediaCountText}>
                  {currentBooking.media.length} fichier{currentBooking.media.length > 1 ? 's' : ''} joint{currentBooking.media.length > 1 ? 's' : ''}
                </Text>
              </View>
            </>
          )}
        </Card.Content>
      </Card>
      
      {/* ✅ Composant PriceBreakdown */}
      {isCalculatingPrice ? (
        <View style={styles.loadingPrice}>
          <ActivityIndicator size="large" color={serviceColor} />
          <Text style={styles.loadingText}>Calcul des frais...</Text>
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
        <Button
          mode="contained"
          style={[styles.button, { backgroundColor: serviceColor }]}
          onPress={handleSubmitRequest}
          disabled={!isBookingComplete() || isCreatingBooking || isCalculatingPrice}
          loading={isCreatingBooking}
        >
          {isCreatingBooking ? 'Traitement en cours...' : 'Continuer vers le paiement'}
        </Button>
        
        {!isBookingComplete() && (
          <Text style={styles.errorText}>
            Veuillez compléter toutes les informations requises avant de continuer.
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
  },
  summaryCard: {
    margin: 15,
    marginBottom: 10,
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
  missingInfoText: {
    fontStyle: 'italic',
    color: '#999',
    marginLeft: 15,
    marginTop: 5,
  },
  addButtonContainer: {
    marginLeft: 15,
    marginTop: 10,
    marginBottom: 5,
  },
  
  // ✅ NOUVEAUX STYLES POUR LES MÉDIAS
  mediaSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaGrid: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    backgroundColor: 'white',
  },
  mediaPreviewSize: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  mediaCountBadge: {
    flexDirection: 'row',
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
    marginLeft: 6,
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
  button: {
    paddingVertical: 8,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  }
});

export default BookingSummaryScreen;