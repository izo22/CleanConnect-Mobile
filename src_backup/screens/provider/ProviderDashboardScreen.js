import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Card, Button, Avatar, Badge } from 'react-native-paper';
import { AuthContext } from '../../context/AuthContext';
import { providerService } from '../../services/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // AJOUT OBLIGATOIRE

const ProviderDashboardScreen = () => {
  const { userInfo } = useContext(AuthContext);
  const navigation = useNavigation();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProviderData = async () => {
      try {
        setLoading(true);
        const response = await providerService.getProviderProfile();
        let providerData = response.data;
        
        console.log("🟡 PROVIDER - ID du prestataire:", providerData._id);
        
        // ✅ NOUVEAU : Récupérer les demandes synchronisées depuis AsyncStorage
        const providerRequestsKey = `provider_requests_${providerData._id}`;
        console.log("🟡 PROVIDER - Clé recherchée:", providerRequestsKey);
        
        const savedRequests = await AsyncStorage.getItem(providerRequestsKey);
        console.log("🟡 PROVIDER - Données trouvées:", savedRequests);
        
        if (savedRequests) {
          providerData.requests = JSON.parse(savedRequests);
          console.log("🟡 PROVIDER - Nombre de demandes chargées:", providerData.requests.length);
        } else {
          providerData.requests = [];
          console.log("🟡 PROVIDER - Aucune demande trouvée dans AsyncStorage");
        }
        
        setProvider(providerData);
        setLoading(false);
      } catch (err) {
        setError('Impossible de charger les données du prestataire');
        setLoading(false);
        console.error(err);
      }
    };

    fetchProviderData();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text>Chargement des données...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={50} color="#FF6B6B" />
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={() => window.location.reload()}>
          Réessayer
        </Button>
      </View>
    );
  }

  // Calculer des statistiques à partir des données réelles
  const pendingRequests = provider.requests?.filter(req => req.status === 'pending').length || 0;
  const completedJobs = provider.requests?.filter(req => req.status === 'completed').length || 0;
  const averageRating = provider.reviews?.length > 0 
    ? provider.reviews.reduce((sum, review) => sum + review.rating, 0) / provider.reviews.length 
    : 0;

  // Formatage du taux horaire pour l'affichage
  const formatServiceRates = () => {
    if (!provider.services || provider.services.length === 0) {
      return "Aucun service configuré";
    }
    
    return provider.services.map(service => (
      `${service.type}: ${service.hourlyRate}€/h`
    )).join(', ');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Avatar.Image 
            size={80} 
            source={provider.profilePicture 
              ? { uri: provider.profilePicture } 
              : { uri: 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff&size=80' }}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{provider.companyName || `${provider.firstName} ${provider.lastName}`}</Text>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={16} color="#FFD700" />
              <Text style={styles.rating}>{averageRating.toFixed(1)}/5</Text>
              <Text style={styles.reviewCount}>({provider.reviews?.length || 0} avis)</Text>
            </View>
          </View>
        </View>

        {/* Carte des statistiques */}
        <Card style={styles.card}>
          <Card.Title title="Tableau de bord" />
          <Card.Content>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pendingRequests}</Text>
                <Text style={styles.statLabel}>Demandes en attente</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedJobs}</Text>
                <Text style={styles.statLabel}>Services complétés</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{provider.averageHourlyRate || 0}€</Text>
                <Text style={styles.statLabel}>Taux horaire moyen</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Informations du prestataire */}
        <Card style={styles.card}>
          <Card.Title title="Mes informations" />
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{provider.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Téléphone:</Text>
              <Text style={styles.infoValue}>{provider.phone || "Non renseigné"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Adresse:</Text>
              <Text style={styles.infoValue}>{provider.address || "Non renseignée"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Services:</Text>
              <Text style={styles.infoValue}>{formatServiceRates()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Zones de service:</Text>
              <Text style={styles.infoValue}>
                {provider.serviceAreas?.join(', ') || "Non renseignées"}
              </Text>
            </View>
          </Card.Content>
          <Card.Actions>
            <Button mode="outlined" onPress={() => navigation.navigate('EditProfile')}>
              Modifier mon profil
            </Button>
          </Card.Actions>
        </Card>

        {/* Dernières demandes */}
        <Card style={styles.card}>
          <Card.Title title="Dernières demandes" />
          <Card.Content>
            {provider.requests && provider.requests.length > 0 ? (
              provider.requests.slice(0, 3).map((request, index) => (
                <View key={index} style={styles.requestItem}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestClient}>{request.clientName}</Text>
                    <Badge>{request.status}</Badge>
                  </View>
                  <Text style={styles.requestService}>{request.serviceType}</Text>
                  <Text style={styles.requestDate}>{new Date(request.date).toLocaleDateString()}</Text>
                </View>
              ))
            ) : (
              <Text>Aucune demande pour le moment</Text>
            )}
          </Card.Content>
          <Card.Actions>
          <Button mode="text" onPress={() => navigation.navigate('Jobs', { screen: 'RequestsScreen' })}>
  Voir toutes les demandes
</Button>
          </Card.Actions>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginVertical: 10,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerInfo: {
    marginLeft: 15,
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rating: {
    marginLeft: 4,
    fontWeight: 'bold',
  },
  reviewCount: {
    marginLeft: 4,
    color: '#666',
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: 'bold',
    width: '30%',
  },
  infoValue: {
    flex: 1,
  },
  requestItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestClient: {
    fontWeight: 'bold',
  },
  requestService: {
    color: '#666',
  },
  requestDate: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
});

export default ProviderDashboardScreen;