// RequestsScreen.js - Écran de liste des missions pour prestataire
import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; // ✅ AJOUT
import { AuthContext } from '../../context/AuthContext';
import { providerService } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RequestsScreen = ({ navigation }) => {
  const { userInfo } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ CORRECTION : useFocusEffect au lieu de useEffect
  // Cela recharge les données à chaque fois que l'écran devient visible
  useFocusEffect(
    React.useCallback(() => {
      console.log("🔄 RequestsScreen - Écran devient visible, rechargement...");
      loadRequests();
    }, [])
  );

  // Charger les demandes depuis AsyncStorage
  const loadRequests = async () => {
    try {
      console.log("🔍 DEBUG - Début loadRequests");
      
      // Récupérer l'ID du prestataire depuis l'API (comme le Dashboard)
      const response = await providerService.getProviderProfile();
      console.log("🔍 DEBUG - Réponse API:", response);
      const providerId = response.data._id;
      console.log("🔍 DEBUG - Provider ID:", providerId);
      
      if (!providerId) {
        console.log("❌ Pas d'ID prestataire disponible");
        setLoading(false);
        return;
      }

      console.log("🟡 REQUESTS - Chargement des demandes pour:", providerId);
      
      // Récupérer les demandes depuis AsyncStorage
      const providerRequestsKey = `provider_requests_${providerId}`;
      console.log("🟡 REQUESTS - Clé recherchée:", providerRequestsKey);
      const savedRequests = await AsyncStorage.getItem(providerRequestsKey);
      console.log("🟡 REQUESTS - Données brutes trouvées:", savedRequests);
      
      if (savedRequests) {
        const requestsData = JSON.parse(savedRequests);
        console.log("🟡 REQUESTS - Nombre de demandes trouvées:", requestsData.length);
        console.log("🟡 REQUESTS - Détails des demandes:", requestsData);
        setRequests(requestsData);
      } else {
        console.log("🟡 REQUESTS - Aucune demande trouvée dans AsyncStorage");
        setRequests([]);
      }
    } catch (error) {
      console.error("❌ Erreur lors du chargement des demandes:", error);
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fonction de rafraîchissement
  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  // Accepter une demande
  const acceptRequest = async (requestId) => {
    try {
      console.log("✅ Acceptation de la demande:", requestId);
      await updateRequestStatus(requestId, 'accepted');
      await loadRequests(); // Recharger la liste
    } catch (error) {
      console.error("❌ Erreur lors de l'acceptation:", error);
    }
  };

  // Refuser une demande
  const declineRequest = async (requestId) => {
    try {
      console.log("❌ Refus de la demande:", requestId);
      await updateRequestStatus(requestId, 'declined');
      await loadRequests(); // Recharger la liste
    } catch (error) {
      console.error("❌ Erreur lors du refus:", error);
    }
  };

  // Mettre à jour le statut d'une demande
  const updateRequestStatus = async (requestId, newStatus) => {
    try {
      // Récupérer l'ID du prestataire depuis l'API
      const response = await providerService.getProviderProfile();
      const providerId = response.data._id;
      
      if (!providerId) return;

      console.log(`🔄 Mise à jour statut ${requestId}: ${newStatus}`);

      // 1. Mettre à jour côté prestataire
      const providerRequestsKey = `provider_requests_${providerId}`;
      const savedRequests = await AsyncStorage.getItem(providerRequestsKey);
      
      if (savedRequests) {
        const requestsData = JSON.parse(savedRequests);
        const updatedRequests = requestsData.map(req => 
          req._id === requestId ? { ...req, status: newStatus } : req
        );
        await AsyncStorage.setItem(providerRequestsKey, JSON.stringify(updatedRequests));
        console.log("✅ Demandes mises à jour côté prestataire");
      }

      // 2. Mettre à jour côté client (synchronisation bidirectionnelle)
      const request = requests.find(r => r._id === requestId);
      if (request) {
        await syncStatusToClient(request.clientId, requestId, newStatus);
      }

      console.log(`✅ Statut mis à jour: ${newStatus}`);
    } catch (error) {
      console.error("❌ Erreur updateRequestStatus:", error);
    }
  };

  // Synchroniser le statut côté client
  const syncStatusToClient = async (clientId, requestId, newStatus) => {
    try {
      // Mettre à jour les réservations du client - utiliser la clé du BookingContext
      const clientBookingsKey = 'user_bookings'; // Même clé que STORAGE_KEYS.USER_BOOKINGS
      const savedBookings = await AsyncStorage.getItem(clientBookingsKey);
      
      if (savedBookings) {
        const bookingsData = JSON.parse(savedBookings);
        const updatedBookings = bookingsData.map(booking => 
          booking._id === requestId ? { ...booking, status: newStatus } : booking
        );
        await AsyncStorage.setItem(clientBookingsKey, JSON.stringify(updatedBookings));
        console.log(`🔄 Statut synchronisé côté client: ${newStatus}`);
      }
    } catch (error) {
      console.error("❌ Erreur syncStatusToClient:", error);
    }
  };

  // Formater la date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Date invalide';
    }
  };

  // Obtenir la couleur du statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FF9800';
      case 'accepted':
      case 'confirmed':
        return '#4CAF50';
      case 'declined':
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#9C27B0';
      default:
        return '#666666';
    }
  };

  // Obtenir le libellé du statut
  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'accepted':
      case 'confirmed':
        return 'Acceptée';
      case 'declined':
        return 'Refusée';
      case 'cancelled':
        return 'Annulée';
      case 'completed':
        return 'Terminée';
      default:
        return status;
    }
  };

  // Obtenir le libellé du type de service
  const getServiceTypeLabel = (serviceType) => {
    switch (serviceType) {
      case 'home':
        return 'Domicile';
      case 'office':
        return 'Bureau';
      case 'building':
        return 'Immeuble';
      default:
        return serviceType;
    }
  };

  // Naviguer vers les détails
  const navigateToDetails = (request) => {
    // Transformer la demande au format attendu par JobDetailsScreen
    const jobData = {
      id: request._id,
      clientName: request.clientName,
      serviceName: getServiceTypeLabel(request.serviceType),
      date: request.dateTime,
      duration: request.duration,
      address: request.address?.fullAddress || 'Adresse non spécifiée',
      coordinates: {
        latitude: 32.0853,  // Coordonnées par défaut Tel Aviv
        longitude: 34.7818
      },
      clientPhone: request.clientPhone || '+972 50 123 4567',
      price: request.price,
      status: request.status,
      notes: request.notes || 'Aucune note'
    };

    navigation.navigate('JobDetails', { 
      jobId: request._id,
      jobData: jobData 
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des demandes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Missions</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={60} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>Aucune mission</Text>
            <Text style={styles.emptySubtitle}>
              Vous n'avez pas encore reçu de demandes de mission
            </Text>
          </View>
        ) : (
          <>
            {/* Statistiques rapides */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {requests.filter(r => r.status === 'pending').length}
                </Text>
                <Text style={styles.statLabel}>En attente</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {requests.filter(r => r.status === 'accepted' || r.status === 'confirmed').length}
                </Text>
                <Text style={styles.statLabel}>Acceptées</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {requests.filter(r => r.status === 'completed').length}
                </Text>
                <Text style={styles.statLabel}>Terminées</Text>
              </View>
            </View>

            {/* Liste des demandes */}
            {requests.map((request) => (
              <TouchableOpacity
                key={request._id}
                style={styles.requestCard}
                onPress={() => navigateToDetails(request)}
              >
                <View style={styles.requestHeader}>
                  <Text style={styles.clientName}>{request.clientName}</Text>
                  <View 
                    style={[
                      styles.statusBadge, 
                      { backgroundColor: getStatusColor(request.status) }
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {getStatusLabel(request.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.requestInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="construct" size={16} color="#666666" />
                    <Text style={styles.infoText}>
                      {getServiceTypeLabel(request.serviceType)}
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar" size={16} color="#666666" />
                    <Text style={styles.infoText}>
                      {formatDate(request.dateTime)}
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="time" size={16} color="#666666" />
                    <Text style={styles.infoText}>
                      {request.duration}h
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Ionicons name="cash" size={16} color="#666666" />
                    <Text style={styles.infoText}>
                      {request.price}₪
                    </Text>
                  </View>
                </View>

                <View style={styles.addressRow}>
                  <Ionicons name="location" size={16} color="#666666" />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {request.address?.fullAddress || 'Adresse non spécifiée'}
                  </Text>
                </View>

                {request.status === 'pending' && (
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        acceptRequest(request._id);
                      }}
                    >
                      <Text style={styles.acceptButtonText}>Accepter</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        declineRequest(request._id);
                      }}
                    >
                      <Text style={styles.declineButtonText}>Refuser</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  loadingText: {
    marginTop: 10,
    color: '#666666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  refreshButton: {
    padding: 5,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666666',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginTop: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    borderRadius: 10,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  requestInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 5,
    width: '45%',
  },
  infoText: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  addressText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 5,
    flex: 1,
  },
  pendingActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 0.45,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F44336',
    flex: 0.45,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#F44336',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default RequestsScreen;