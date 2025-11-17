import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Title, Paragraph, Divider, Button, Chip, List, useTheme } from 'react-native-paper';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY, CLEANING_FREQUENCY_LABELS } from '../../config/constants';
import { useBooking } from '../../context/BookingContext';

const ServiceDetails = ({ route, navigation }) => {
  const { serviceType } = route.params;
  const theme = useTheme();
  const { updateBooking } = useBooking();
  
  // État local pour les options sélectionnées
  const [selectedFrequency, setSelectedFrequency] = useState(CLEANING_FREQUENCY.ONE_TIME);
  const [selectedDuration, setSelectedDuration] = useState(2); // Par défaut 2 heures
  
  // Couleur associée au type de service
  const getServiceColor = () => {
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
  
  // Contenu spécifique selon le type de service
  const getServiceSpecificContent = () => {
    switch (serviceType) {
      case 'home':
        return {
          title: 'Nettoyage à domicile',
          description: 'Nos services de nettoyage résidentiel s\'adaptent parfaitement à vos besoins. De l\'entretien régulier au nettoyage approfondi, nos professionnels prennent soin de votre espace de vie.',
          features: [
            'Nettoyage des sols et surfaces',
            'Dépoussiérage complet',
            'Nettoyage des sanitaires et cuisine',
            'Aspiration des tapis et moquettes',
            'Produits écologiques disponibles'
          ],
          durations: [1, 2, 3, 4],
        };
      case 'office':
        return {
          title: 'Nettoyage de bureaux',
          description: 'Maintenez un environnement de travail propre et sain. Nos services de nettoyage de bureaux sont conçus pour les espaces professionnels de toutes tailles.',
          features: [
            'Nettoyage des espaces communs',
            'Désinfection des surfaces de travail',
            'Entretien des sanitaires',
            'Vidage des corbeilles',
            'Services en dehors des heures de bureau'
          ],
          durations: [2, 3, 4, 6, 8],
        };
      case 'building':
        return {
          title: 'Nettoyage d\'immeubles',
          description: 'Services complets pour l\'entretien des parties communes d\'immeubles résidentiels et commerciaux. Adaptés aux besoins spécifiques de votre bâtiment.',
          features: [
            'Nettoyage des entrées et halls',
            'Entretien des escaliers et ascenseurs',
            'Nettoyage des vitres accessibles',
            'Entretien des locaux techniques',
            'Nettoyage des parkings et espaces extérieurs'
          ],
          durations: [3, 4, 6, 8],

        };
      default:
        return {
          title: 'Service de nettoyage',
          description: 'Nos services professionnels de nettoyage.',
          features: [],
          durations: [2, 3, 4],
        };
    }
  };
  
  const serviceContent = getServiceSpecificContent();
  const serviceColor = getServiceColor();
  
  // Gestion du passage à l'écran de recherche de prestataires
  const handleContinue = () => {
    // Mise à jour du contexte de réservation
    updateBooking({
      serviceType: serviceType,
      duration: selectedDuration,
      frequency: selectedFrequency
    });
    
    // Navigation vers l'écran de recherche de prestataires
    navigation.navigate('ProviderSearch', { 
      serviceType: serviceType,
      duration: selectedDuration,
      frequency: selectedFrequency
    });
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: serviceColor }]}>
        <Title style={styles.headerTitle}>{serviceContent.title}</Title>
        <Text style={styles.headerSubtitle}>{SERVICE_TYPE_LABELS[serviceType]}</Text>
      </View>
      
      <Card style={styles.infoCard}>
        <Card.Content>
          <Paragraph style={styles.description}>{serviceContent.description}</Paragraph>
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Services inclus</Title>
          <List.Section>
            {serviceContent.features.map((feature, index) => (
              <List.Item
                key={index}
                title={feature}
                left={props => <List.Icon {...props} icon="check" color={serviceColor} />}
                titleStyle={styles.featureText}
              />
            ))}
          </List.Section>
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>Fréquence</Title>
          <View style={styles.optionsContainer}>
            {Object.entries(CLEANING_FREQUENCY).map(([key, value]) => (
              <Chip
                key={key}
                selected={selectedFrequency === value}
                onPress={() => setSelectedFrequency(value)}
                style={[
                  styles.chip, 
                  selectedFrequency === value ? { backgroundColor: serviceColor } : null
                ]}
                textStyle={selectedFrequency === value ? styles.selectedChipText : null}
              >
                {CLEANING_FREQUENCY_LABELS[value]}
              </Chip>
            ))}
          </View>
          
          <Title style={styles.sectionTitle}>Durée (heures)</Title>
          <View style={styles.optionsContainer}>
            {serviceContent.durations.map(duration => (
              <Chip
                key={duration}
                selected={selectedDuration === duration}
                onPress={() => setSelectedDuration(duration)}
                style={[
                  styles.chip, 
                  selectedDuration === duration ? { backgroundColor: serviceColor } : null
                ]}
                textStyle={selectedDuration === duration ? styles.selectedChipText : null}
              >
                {duration}h
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>
      
      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          style={[styles.button, { backgroundColor: serviceColor }]}
          onPress={handleContinue}
        >
          Trouver un prestataire
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
  infoCard: {
    margin: 15,
    borderRadius: 8,
    elevation: 4,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 15,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  chip: {
    margin: 4,
  },
  selectedChipText: {
    color: 'white',
  },
  buttonContainer: {
    padding: 15,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 8,
  }
});

export default ServiceDetails;
