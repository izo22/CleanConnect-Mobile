import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  Platform
} from 'react-native';
import { Card, Button, Avatar, Badge, Divider, List, IconButton } from 'react-native-paper';
import { AuthContext } from '../../context/AuthContext';
import { providerService } from '../../services/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as RootNavigation from '../../navigation/RootNavigation';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProviderProfileScreen = () => {
  const authContext = useContext(AuthContext); // Récupérer le contexte complet
  const navigation = useNavigation();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProviderData = async () => {
    try {
      setLoading(true);
      const response = await providerService.getProviderProfile();
      setProvider(response.data);
      setError(null);
    } catch (err) {
      setError('Impossible de charger les données du prestataire');
      console.error('Erreur lors du chargement du profil:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Charger les données au montage du composant
  useEffect(() => {
    fetchProviderData();
  }, []);

  // Actualiser les données lorsque l'écran redevient actif
  useFocusEffect(
    React.useCallback(() => {
      fetchProviderData();
    }, [])
  );

  // Gérer le téléchargement d'image de profil
  const handleImageUpload = async () => {
    try {
      // Demander les permissions
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission requise', 'Nous avons besoin de votre permission pour accéder à vos photos.');
          return;
        }
      }

      // Lancer le sélecteur d'image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        
        // Préparer l'objet pour l'upload
        const imageData = {
          uri: selectedImage.uri,
          type: 'image/jpeg',
          name: 'profile-image.jpg',
        };

        setLoading(true);
        
        // Envoyer l'image au serveur
        const response = await providerService.updateProfileImage(imageData);
        
        // Actualiser les données du prestataire
        if (response.data && response.data.success) {
          Alert.alert('Succès', 'Votre photo de profil a été mise à jour.');
          fetchProviderData();
        }
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement de l\'image:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour votre photo de profil.');
    } finally {
      setLoading(false);
    }
  };

  // Fonction de déconnexion
 // Version avec logs de débogage

 const handleLogoutDirect = async () => {
    console.log("Déconnexion directe déclenchée");
    try {
      setLoading(true);
      
      // Nettoyage direct d'AsyncStorage (méthode la plus fiable)
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userData');
      
      // Réinitialiser l'état global si accessible
      if (authContext) {
        if (authContext.setUserToken) authContext.setUserToken(null);
        if (authContext.setUserInfo) authContext.setUserInfo(null);
        if (authContext.setUserRole) authContext.setUserRole(null);
      }
      
      // Navigation vers l'écran d'accueil
      RootNavigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
      console.log("Navigation réinitialisée");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      Alert.alert("Erreur", "Impossible de vous déconnecter. Veuillez fermer et relancer l'application.");
    } finally {
      setLoading(false);
    }
  };
  
  // Remplacez le bouton de déconnexion par celui-ci dans le JSX
  <Button 
    mode="outlined" 
    icon="logout"
    onPress={handleLogoutDirect}  // Utilisez handleLogoutDirect à la place de handleLogout
    style={[styles.actionButton, styles.logoutButton]}
    labelStyle={{ color: '#FF6B6B' }}
  >
    Déconnexion
  </Button>
  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text>Chargement des données...</Text>
      </View>
    );
  }

  if (error && !provider) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={50} color="#FF6B6B" />
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={fetchProviderData}>
          Réessayer
        </Button>
      </View>
    );
  }

  // Si aucune donnée n'est disponible, afficher un message d'erreur
  if (!provider) {
    return (
      <View style={styles.centerContainer}>
        <Text>Aucune donnée de profil disponible.</Text>
        <Button mode="contained" onPress={fetchProviderData} style={{ marginTop: 20 }}>
          Actualiser
        </Button>
      </View>
    );
  }

  // Calculer des statistiques à partir des données réelles
  const pendingRequests = provider.requests?.filter(req => req.status === 'pending').length || 0;
  const completedJobs = provider.requests?.filter(req => req.status === 'completed').length || 0;
  const averageRating = provider.rating || 0;
  const totalReviews = provider.reviews?.length || 0;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchProviderData();
        }}
      >
        {/* En-tête avec photo de profil */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <TouchableOpacity onPress={handleImageUpload}>
              <Avatar.Text 
                size={80} 
                label={`${provider.firstName.charAt(0)}${provider.lastName.charAt(0)}`}
                backgroundColor="#0D8ABC"
                color="#FFFFFF"
              />
              <View style={styles.editIconContainer}>
                <Icon name="edit" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{`${provider.firstName} ${provider.lastName}`}</Text>
              <View style={styles.ratingContainer}>
                <Icon name="star" size={16} color="#FFD700" />
                <Text style={styles.rating}>{averageRating.toFixed(1)}/5</Text>
                <Text style={styles.reviewCount}>({totalReviews} avis)</Text>
              </View>
              <Text style={styles.memberSince}>
                Membre depuis {new Date(provider.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          
          {provider.bio && (
            <Card.Content style={styles.bioSection}>
              <Text style={styles.bioText}>{provider.bio}</Text>
            </Card.Content>
          )}
          
          <Card.Actions>
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('EditProviderProfile', { provider })}
              style={styles.editButton}
            >
              Modifier mon profil
            </Button>
          </Card.Actions>
        </Card>

        {/* Carte des statistiques */}
        <Card style={styles.card}>
          <Card.Title title="Mes statistiques" />
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
                <Text style={styles.statValue}>{provider.hourlyRate}€</Text>
                <Text style={styles.statLabel}>Taux horaire moyen</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Services proposés */}
        <Card style={styles.card}>
          <Card.Title 
            title="Mes services" 
            right={(props) => (
              <IconButton
                {...props}
                icon="plus"
                onPress={() => navigation.navigate('AddService')}
              />
            )}
          />
          <Card.Content>
            {provider.serviceDetails && provider.serviceDetails.length > 0 ? (
              provider.serviceDetails.map((service, index) => (
                <View key={index} style={styles.serviceItem}>
                  <View style={styles.serviceHeader}>
                    <Text style={styles.serviceType}>
                      {service.type.charAt(0).toUpperCase() + service.type.slice(1)}
                    </Text>
                    <Text style={styles.serviceRate}>{service.hourlyRate}€/h</Text>
                  </View>
                  {service.description && (
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  )}
                  <View style={styles.serviceActions}>
                    <Button 
                      mode="text" 
                      compact 
                      onPress={() => navigation.navigate('EditService', { service, serviceIndex: index })}
                    >
                      Modifier
                    </Button>
                    <Button 
                      mode="text" 
                      compact 
                      textColor="#FF6B6B"
                      onPress={() => {
                        Alert.alert(
                          'Supprimer le service',
                          'Êtes-vous sûr de vouloir supprimer ce service ?',
                          [
                            { text: 'Annuler', style: 'cancel' },
                            { 
                              text: 'Supprimer', 
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await providerService.deleteService(service._id);
                                  Alert.alert('Succès', 'Le service a été supprimé.');
                                  fetchProviderData();
                                } catch (error) {
                                  Alert.alert('Erreur', 'Impossible de supprimer le service.');
                                }
                              }
                            }
                          ]
                        );
                      }}
                    >
                      Supprimer
                    </Button>
                  </View>
                  {index < provider.serviceDetails.length - 1 && <Divider style={styles.divider} />}
                </View>
              ))
            ) : (
              <Text style={styles.emptyMessage}>
                Vous n'avez pas encore ajouté de services. Cliquez sur le + pour ajouter votre premier service.
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Zones de service */}
        <Card style={styles.card}>
          <Card.Title title="Zones de service" />
          <Card.Content>
            <View style={styles.serviceAreasContainer}>
              {provider.serviceAreas && provider.serviceAreas.length > 0 ? (
                provider.serviceAreas.map((area, index) => (
                  <Badge key={index} style={styles.areaBadge}>
                    {area}
                  </Badge>
                ))
              ) : (
                <Text style={styles.emptyMessage}>
                  Aucune zone de service définie
                </Text>
              )}
            </View>
            <Button 
              mode="outlined" 
              onPress={() => navigation.navigate('EditServiceAreas', { areas: provider.serviceAreas })}
              style={styles.actionButton}
            >
              Gérer mes zones de service
            </Button>
          </Card.Content>
        </Card>

        {/* Disponibilités */}
        <Card style={styles.card}>
          <Card.Title title="Mes disponibilités" />
          <Card.Content>
            {provider.availability && provider.availability.length > 0 ? (
              provider.availability.map((slot, index) => {
                // Convertir le numéro du jour en nom
                const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
                const dayName = days[slot.day];
                
                return (
                  <View key={index} style={styles.availabilityItem}>
                    <Text style={styles.dayName}>{dayName}</Text>
                    <Text style={styles.timeSlot}>{slot.startTime} - {slot.endTime}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyMessage}>
                Aucune disponibilité définie
              </Text>
            )}
            <Button 
              mode="outlined" 
              onPress={() => navigation.navigate('EditAvailability', { availability: provider.availability })}
              style={styles.actionButton}
            >
              Gérer mes disponibilités
            </Button>
          </Card.Content>
        </Card>

        {/* Informations de contact */}
        <Card style={styles.card}>
          <Card.Title title="Coordonnées" />
          <Card.Content>
            <List.Item
              title="Email"
              description={provider.email}
              left={props => <List.Icon {...props} icon="email" />}
            />
            <List.Item
              title="Téléphone"
              description={provider.phone || "Non renseigné"}
              left={props => <List.Icon {...props} icon="phone" />}
            />
            <Button 
              mode="outlined" 
              onPress={() => navigation.navigate('EditContact', { 
                email: provider.email, 
                phone: provider.phone 
              })}
              style={styles.actionButton}
            >
              Modifier mes coordonnées
            </Button>
          </Card.Content>
        </Card>

        {/* Expérience et certifications */}
        <Card style={styles.card}>
          <Card.Title title="Expérience & Certifications" />
          <Card.Content>
            <List.Item
              title="Années d'expérience"
              description={`${provider.experience || 0} an${provider.experience > 1 ? 's' : ''}`}
              left={props => <List.Icon {...props} icon="briefcase" />}
            />
            
            <Text style={styles.certificationTitle}>Certifications:</Text>
            {provider.certifications && provider.certifications.length > 0 ? (
              provider.certifications.map((cert, index) => (
                <Text key={index} style={styles.certificationItem}>• {cert}</Text>
              ))
            ) : (
              <Text style={styles.emptyMessage}>Aucune certification ajoutée</Text>
            )}
            
            <Button 
              mode="outlined" 
              onPress={() => navigation.navigate('EditExperience', { 
                experience: provider.experience,
                certifications: provider.certifications
              })}
              style={styles.actionButton}
            >
              Modifier mon expérience
            </Button>
          </Card.Content>
        </Card>
        
        {/* Carte de déconnexion */}
        <Card style={styles.card}>
          <Card.Title title="Compte" />
          <Card.Content>
            <Button 
              mode="outlined" 
              icon="logout"
              onPress={handleLogout}
              style={[styles.actionButton, styles.logoutButton]}
              labelStyle={{ color: '#FF6B6B' }}
            >
              Déconnexion
            </Button>
          </Card.Content>
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
  profileCard: {
    marginBottom: 16,
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3498db',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    marginLeft: 16,
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
  memberSince: {
    marginTop: 4,
    color: '#666',
    fontSize: 12,
  },
  bioSection: {
    marginTop: 10,
    marginBottom: 16,
  },
  bioText: {
    fontStyle: 'italic',
    color: '#555',
  },
  card: {
    marginBottom: 16,
  },
  editButton: {
    width: '100%',
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
  serviceItem: {
    marginBottom: 12,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceType: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  serviceRate: {
    fontWeight: 'bold',
    color: '#0066CC',
  },
  serviceDescription: {
    marginTop: 4,
    color: '#666',
  },
  serviceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  divider: {
    marginVertical: 12,
  },
  emptyMessage: {
    fontStyle: 'italic',
    color: '#999',
    textAlign: 'center',
    marginVertical: 12,
  },
  serviceAreasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  areaBadge: {
    margin: 4,
    backgroundColor: '#E1F5FE',
    color: '#0277BD',
  },
  actionButton: {
    marginTop: 12,
  },
  availabilityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dayName: {
    fontWeight: 'bold',
  },
  timeSlot: {
    color: '#666',
  },
  certificationTitle: {
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  certificationItem: {
    marginLeft: 8,
    marginBottom: 4,
    color: '#555',
  },
  logoutButton: {
    borderColor: '#FF6B6B',
    marginVertical: 10,
  },
});

export default ProviderProfileScreen;