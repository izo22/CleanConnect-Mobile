// JobDetailsScreen.js - Modification pour utiliser l'API

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { providerService } from '../../services/api'; // Importez votre service API

const JobDetailsScreen = ({ navigation, route }) => {
  const { jobId } = route.params;
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadJobDetails();
  }, []);

  // JobDetailsScreen.js - Fonction loadJobDetails avec code de débogage
// JobDetailsScreen.js - Fonction loadJobDetails optimisée pour votre format de réponse API

const loadJobDetails = async () => {
  setLoading(true);
  setError(null);
  
  try {
    // Utiliser la méthode getJobDetails existante dans votre service
    const response = await providerService.getJobDetails(jobId);
    
    // En supposant que la réponse a une structure similaire à getJobs:
    // { success: true, message: "...", data: {...} }
    // où data contient l'objet mission
    
    if (response && response.success) {
      let jobData;
      
      if (response.data && typeof response.data === 'object') {
        // La mission est probablement dans la propriété data
        jobData = response.data;
      } else {
        // Fallback au cas où la structure serait différente
        jobData = response;
      }
      
      console.log('Détails de la mission chargés');
      setJob(jobData);
    } else {
      throw new Error(response.message || 'Échec du chargement des détails');
    }
  } catch (err) {
    console.error('Erreur lors du chargement des détails de la mission:', err);
    setError('Impossible de charger les détails de la mission.');
  } finally {
    setLoading(false);
  }
};
  // Formater la date et l'heure
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} à ${hours}:${minutes}`;
  };

  // Ouvrir l'application de navigation
  const openMaps = (latitude, longitude, address) => {
    const location = `${latitude},${longitude}`;
    const encodedAddress = encodeURIComponent(address);
    
    let url;
    if (Platform.OS === 'ios') {
      url = `maps:?q=${encodedAddress}&ll=${location}`;
    } else {
      url = `geo:${location}?q=${encodedAddress}`;
    }
    
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location}`;
          return Linking.openURL(googleMapsUrl);
        }
      })
      .catch((error) => console.error('Erreur lors de l\'ouverture de l\'application de navigation', error));
  };

  // Appeler le client
  const callClient = (phoneNumber) => {
    const url = `tel:${phoneNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('Erreur', 'Impossible de passer un appel depuis cet appareil');
        }
      })
      .catch((error) => console.error('Erreur lors de l\'appel', error));
  };

  // Envoyer un message au client
  const messageClient = (phoneNumber) => {
    const url = `sms:${phoneNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('Erreur', 'Impossible d\'envoyer un message depuis cet appareil');
        }
      })
      .catch((error) => console.error('Erreur lors de l\'envoi du message', error));
  };

  // Confirmer la mission avec l'API
  const confirmJob = () => {
    Alert.alert(
      'Confirmer la mission',
      'Êtes-vous sûr de vouloir confirmer cette mission ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              // Utiliser la méthode acceptJob existante dans votre service
              await providerService.acceptJob(jobId);
              
              // Recharger les détails pour obtenir les données mises à jour
              loadJobDetails();
              
              Alert.alert(
                'Mission confirmée',
                'La mission a été confirmée avec succès.'
              );
            } catch (err) {
              console.error('Erreur lors de la confirmation de la mission:', err);
              Alert.alert(
                'Erreur',
                'Impossible de confirmer la mission. Veuillez réessayer.'
              );
            }
          },
        },
      ]
    );
  };

  // Annuler la mission avec l'API
  const cancelJob = () => {
    Alert.alert(
      'Annuler la mission',
      'Êtes-vous sûr de vouloir annuler cette mission ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              // Utiliser la méthode declineJob existante dans votre service
              await providerService.declineJob(jobId);
              
              // Recharger les détails pour obtenir les données mises à jour
              loadJobDetails();
              
              Alert.alert(
                'Mission annulée',
                'La mission a été annulée avec succès.'
              );
            } catch (err) {
              console.error('Erreur lors de l\'annulation de la mission:', err);
              Alert.alert(
                'Erreur',
                'Impossible d\'annuler la mission. Veuillez réessayer.'
              );
            }
          },
        },
      ]
    );
  };

  // Marquer la mission comme terminée
  const completeJob = () => {
    Alert.alert(
      'Terminer la mission',
      'Êtes-vous sûr de vouloir marquer cette mission comme terminée ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminer',
          onPress: async () => {
            try {
              // Utiliser la méthode completeJob existante dans votre service
              await providerService.completeJob(jobId);
              
              // Recharger les détails pour obtenir les données mises à jour
              loadJobDetails();
              
              Alert.alert(
                'Mission terminée',
                'La mission a été marquée comme terminée avec succès.'
              );
            } catch (err) {
              console.error('Erreur lors de la complétion de la mission:', err);
              Alert.alert(
                'Erreur',
                'Impossible de terminer la mission. Veuillez réessayer.'
              );
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={60} color="#F44336" />
        <Text style={styles.errorText}>{error || "Impossible de charger les détails de la mission"}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadJobDetails}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* En-tête avec statut */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.clientName}>{job.clientName}</Text>
            <View 
              style={[
                styles.statusBadge, 
                job.status === 'confirmed' ? styles.confirmedStatus : 
                job.status === 'pending' ? styles.pendingStatus : 
                job.status === 'completed' ? styles.completedStatus : 
                styles.cancelledStatus
              ]}
            >
              <Text style={styles.statusText}>
                {job.status === 'confirmed' ? 'Confirmé' : 
                 job.status === 'pending' ? 'En attente' : 
                 job.status === 'completed' ? 'Terminé' : 
                 'Annulé'}
              </Text>
            </View>
          </View>
        </View>

        {/* Boutons d'action UNIQUEMENT pour les missions en attente */}
        {job.status === 'pending' && (
          <View style={styles.pendingContainer}>
            <Text style={styles.pendingTitle}>Nouvelle demande de mission</Text>
            <Text style={styles.pendingSubtitle}>Merci de confirmer ou refuser cette demande</Text>
            
            <View style={styles.pendingActions}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmJob}
              >
                <Text style={styles.confirmButtonText}>Accepter</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.declineButton}
                onPress={cancelJob}
              >
                <Text style={styles.declineButtonText}>Décliner</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Informations essentielles */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Ionicons name="calendar" size={20} color="#666666" />
            <Text style={styles.sectionText}>{formatDateTime(job.date)}</Text>
          </View>
          
          <View style={styles.sectionRow}>
            <Ionicons name="time" size={20} color="#666666" />
            <Text style={styles.sectionText}>{job.duration} heures</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.sectionRow}
            onPress={() => openMaps(job.coordinates.latitude, job.coordinates.longitude, job.address)}
          >
            <Ionicons name="location" size={20} color="#666666" />
            <Text style={[styles.sectionText, styles.addressText]}>{job.address}</Text>
            <Ionicons name="navigate" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Actions rapides (uniquement pour les missions confirmées) */}
        {job.status === 'confirmed' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => callClient(job.clientPhone)}
            >
              <View style={[styles.actionIcon, styles.callIcon]}>
                <Ionicons name="call" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Appeler</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => messageClient(job.clientPhone)}
            >
              <View style={[styles.actionIcon, styles.messageIcon]}>
                <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => openMaps(job.coordinates.latitude, job.coordinates.longitude, job.address)}
            >
              <View style={[styles.actionIcon, styles.directionIcon]}>
                <Ionicons name="navigate" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Itinéraire</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Détails du service */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Détails du service</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Service</Text>
            <Text style={styles.detailValue}>{job.serviceName}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Prix</Text>
            <Text style={styles.detailValue}>{job.price} ₪</Text>
          </View>
          
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{job.notes || "Aucune note"}</Text>
          </View>
        </View>
        
        {/* Tâches demandées - Uniquement si disponibles dans l'API */}
        {job.requestedItems && job.requestedItems.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Tâches demandées</Text>
            
            {job.requestedItems.map((item) => (
              <View key={item.id} style={styles.checklistItem}>
                <Ionicons 
                  name={item.checked ? "checkmark-circle" : "ellipse-outline"} 
                  size={24} 
                  color={item.checked ? "#4CAF50" : "#999999"} 
                />
                <Text style={styles.checklistText}>{item.name}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Contact client (pour les missions en attente) */}
        {job.status === 'pending' && (
          <TouchableOpacity 
            style={styles.contactClientButton}
            onPress={() => callClient(job.clientPhone)}
          >
            <Ionicons name="call" size={20} color="#007AFF" />
            <Text style={styles.contactClientText}>Contacter le client</Text>
          </TouchableOpacity>
        )}

        {/* Historique du client - Uniquement si disponible dans l'API */}
        {job.clientHistory && job.clientHistory.length > 0 && job.status !== 'pending' && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Historique du client</Text>
            
            {job.clientHistory.map((historyItem) => (
              <View key={historyItem.id} style={styles.historyItem}>
                <Text style={styles.historyDate}>
                  {new Date(historyItem.date).toLocaleDateString()}
                </Text>
                <Text style={styles.historyService}>{historyItem.serviceName}</Text>
                <View
                  style={[
                    styles.historyStatus,
                    historyItem.status === 'completed' ? styles.completedHistoryStatus : styles.cancelledHistoryStatus
                  ]}
                >
                  <Text style={styles.historyStatusText}>
                    {historyItem.status === 'completed' ? 'Terminé' : 'Annulé'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Bouton pour marquer comme terminé - Pour statut confirmed uniquement */}
        {job.status === 'confirmed' && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={completeJob}
          >
            <Text style={styles.completeButtonText}>Marquer comme terminé</Text>
          </TouchableOpacity>
        )}

        {/* Bouton d'annulation pour statuts confirmés uniquement */}
        {job.status === 'confirmed' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelJob}
          >
            <Text style={styles.cancelButtonText}>Annuler la mission</Text>
          </TouchableOpacity>
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
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginHorizontal: 30,
    marginTop: 15,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  confirmedStatus: {
    backgroundColor: '#E8F5E9',
  },
  pendingStatus: {
    backgroundColor: '#FFF8E1',
  },
  completedStatus: {
    backgroundColor: '#E8F5E9',
  },
  cancelledStatus: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
  },
  // Styles pour les missions en attente
  pendingContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  pendingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  pendingSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
  },
  pendingActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 30,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  declineButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '500',
  },
  contactClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    padding: 15,
  },
  contactClientText: {
    marginLeft: 10,
    color: '#007AFF',
    fontSize: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginBottom: 10,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  sectionText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 10,
    flex: 1,
  },
  addressText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    marginBottom: 10,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  callIcon: {
    backgroundColor: '#4CAF50',
  },
  messageIcon: {
    backgroundColor: '#FF9800',
  },
  directionIcon: {
    backgroundColor: '#2196F3',
  },
  actionText: {
    fontSize: 14,
    color: '#666666',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  notesContainer: {
    marginTop: 15,
  },
  notesLabel: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 5,
  },
  notesText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 5,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  checklistText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  historyDate: {
    fontSize: 14,
    color: '#666666',
  },
  historyService: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
    marginLeft: 10,
  },
  historyStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  completedHistoryStatus: {
    backgroundColor: '#E8F5E9',
  },
  cancelledHistoryStatus: {
    backgroundColor: '#FFEBEE',
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
  },
  completeButton: {
    margin: 15,
    marginBottom: 5,
    padding: 15,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    margin: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 25,
  },
  cancelButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default JobDetailsScreen;