import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Text, Card, Title, Paragraph, Button, useTheme } from 'react-native-paper';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext'; // Ajouté cette ligne

const ServiceCard = ({ title, description, color, iconName, onPress }) => {
  return (
    <Card 
      style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}
      onPress={onPress}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Title style={styles.cardTitle}>{title}</Title>
        </View>
        <Paragraph style={styles.cardDescription}>{description}</Paragraph>
      </Card.Content>
      <Card.Actions style={styles.cardActions}>
        <Button mode="contained" style={{ backgroundColor: color }} onPress={onPress}>
          Réserver
        </Button>
      </Card.Actions>
    </Card>
  );
};

const HomeScreen = ({ navigation }) => {
  const theme = useTheme();
  const { userInfo } = useAuth();
  const { updateBooking } = useBooking(); // Ajouté cette ligne
  
  // Log pour débogage
  console.log("UserInfo dans HomeScreen:", userInfo);
  
  const serviceOptions = [
    {
      type: SERVICE_TYPES.HOME,
      title: SERVICE_TYPE_LABELS.home,
      color: theme.colors.homeService,
      description: 'Nettoyage professionnel pour votre domicile, adapté à vos besoins spécifiques.',
      iconName: 'home'
    },
    {
      type: SERVICE_TYPES.OFFICE,
      title: SERVICE_TYPE_LABELS.office,
      color: theme.colors.officeService,
      description: 'Services complets pour bureaux et espaces professionnels.',
      iconName: 'briefcase'
    },
    {
      type: SERVICE_TYPES.BUILDING,
      title: SERVICE_TYPE_LABELS.building,
      color: theme.colors.buildingService,
      description: 'Entretien des parties communes et des immeubles résidentiels.',
      iconName: 'building'
    }
  ];

  const navigateToService = (serviceType) => {
    console.log('Navigation vers ProviderSearch avec type:', serviceType);
    
    // Mettre à jour le contexte de réservation
    updateBooking({ 
      serviceType: serviceType,
      duration: 2,
      frequency: 'one_time'
    });
    
    // Ensuite naviguer vers la recherche de prestataires
    navigation.navigate('ProviderSearch', { 
      serviceType,
      duration: '2',
      frequency: 'once'
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Bonjour, {userInfo?.firstName || ''} {userInfo?.lastName || 'Client'}
        </Text>
        <Text style={styles.subtitle}>Quel type de service recherchez-vous ?</Text>
      </View>

      <View style={styles.servicesContainer}>
        {serviceOptions.map((service) => (
          <ServiceCard
            key={service.type}
            title={service.title}
            description={service.description}
            color={service.color}
            iconName={service.iconName}
            onPress={() => navigateToService(service.type)}
          />
        ))}
      </View>

      <View style={styles.actionsContainer}>
        <Button 
          mode="outlined" 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Dashboard')}
        >
          Mes réservations
        </Button>
        <Button 
          mode="outlined" 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Profile')}
        >
          Mon profil
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
    backgroundColor: '#2E86C1',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginBottom: 10,
  },
  servicesContainer: {
    padding: 15,
  },
  card: {
    marginBottom: 15,
    elevation: 2,
    borderRadius: 8,
  },
  cardContent: {
    paddingVertical: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  cardDescription: {
    color: '#666',
  },
  cardActions: {
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    marginBottom: 20,
  },
  actionButton: {
    width: '45%',
  }
});

export default HomeScreen;