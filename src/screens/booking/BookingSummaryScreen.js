// src/screens/booking/BookingSummaryScreen.js
// ✅ MODIFIÉ - Intégration du nouveau système de pricing avec PriceBreakdown

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Title, Paragraph, Button, Divider, List, ActivityIndicator, useTheme } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY_LABELS, calculatePlatformFees } from '../../config/constants';
import PriceBreakdown from '../../components/PriceBreakdown';

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
        </Card.Content>
      </Card>
      
      {/* ✅ NOUVEAU - Composant PriceBreakdown */}
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