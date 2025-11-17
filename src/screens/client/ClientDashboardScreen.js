// src/screens/client/ClientDashboardScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Title, Chip, Button, Divider, ActivityIndicator, useTheme, FAB } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constantes pour les statuts de réservation - MISES À JOUR
const BOOKING_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',       // ✅ AJOUTÉ
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DECLINED: 'declined',       // ✅ AJOUTÉ
};

// Labels pour les statuts - MIS À JOUR
const BOOKING_STATUS_LABELS = {
  [BOOKING_STATUS.PENDING]: 'En attente',
  [BOOKING_STATUS.ACCEPTED]: 'Acceptée',      // ✅ AJOUTÉ
  [BOOKING_STATUS.CONFIRMED]: 'Confirmée',
  [BOOKING_STATUS.IN_PROGRESS]: 'En cours',
  [BOOKING_STATUS.COMPLETED]: 'Terminée',
  [BOOKING_STATUS.CANCELLED]: 'Annulée',
  [BOOKING_STATUS.DECLINED]: 'Refusée',       // ✅ AJOUTÉ
};

// Couleurs pour les statuts - MISES À JOUR
const BOOKING_STATUS_COLORS = {
  [BOOKING_STATUS.PENDING]: '#FF9800',        // Orange
  [BOOKING_STATUS.ACCEPTED]: '#4CAF50',       // ✅ AJOUTÉ - Vert
  [BOOKING_STATUS.CONFIRMED]: '#4CAF50',      // Vert
  [BOOKING_STATUS.IN_PROGRESS]: '#2196F3',    // Bleu
  [BOOKING_STATUS.COMPLETED]: '#9C27B0',      // Violet
  [BOOKING_STATUS.CANCELLED]: '#F44336',      // Rouge
  [BOOKING_STATUS.DECLINED]: '#F44336',       // ✅ AJOUTÉ - Rouge
};

const ClientDashboardScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { userBookings, fetchUserBookings, isLoadingBookings, bookingError } = useBooking();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // ✅ CHANGÉ - commence par "pending"
  
  // Chargement initial des réservations
  useEffect(() => {
    loadBookings();
  }, []);
  
  // Recharger les réservations quand l'écran est affiché
  useFocusEffect(
    React.useCallback(() => {
      loadBookings();
      
      // DEBUG : Vérifier le contenu d'AsyncStorage
      const debugAsyncStorage = async () => {
        try {
          const savedBookings = await AsyncStorage.getItem('userBookings');
          if (savedBookings) {
            const bookingsData = JSON.parse(savedBookings);
            bookingsData.forEach((booking, index) => {
                id: booking._id,
                status: booking.status,
                clientName: booking.selectedProvider?.name
              });
            });
          }
        } catch (error) {
        }
      };
      debugAsyncStorage();

      // Debug pour vérifier les deux clés
      const debugDetailedBookings = async () => {
        try {
          const savedBookings = await AsyncStorage.getItem('user_bookings');
          if (savedBookings) {
            const bookingsData = JSON.parse(savedBookings);
            bookingsData.forEach((booking, index) => {
                id: booking._id,
                status: booking.status,
                dateTime: booking.dateTime,
                provider: booking.selectedProvider?.name,
                price: booking.price
              });
            });
            
            // Vérifier spécifiquement les IDs des réservations du prestataire
            const acceptedIds = ['booking-1757415656372', 'booking-1757415463294', 'booking-1757331763652'];
            acceptedIds.forEach(id => {
              const booking = bookingsData.find(b => b._id === id);
              if (booking) {
              } else {
              }
            });
          }
        } catch (error) {
        }
      };
      debugDetailedBookings();
      
      return () => {};
    }, [])
  );
  
  // Fonction pour charger/recharger les réservations
  const loadBookings = async () => {
    setRefreshing(true);
    await fetchUserBookings();
    setRefreshing(false);
  };
  
  // Filtrer les réservations selon le tab actif - NOUVELLE LOGIQUE
  const getFilteredBookings = () => {
    if (activeTab === 'pending') {
      // ✅ EN ATTENTE : pending uniquement
      return userBookings.filter(booking => 
        booking.status === BOOKING_STATUS.PENDING
      );
    } else if (activeTab === 'confirmed') {
      // ✅ CONFIRMÉES : accepted + confirmed + in_progress
      return userBookings.filter(booking => 
        booking.status === BOOKING_STATUS.ACCEPTED ||
        booking.status === BOOKING_STATUS.CONFIRMED ||
        booking.status === BOOKING_STATUS.IN_PROGRESS
      );
    } else if (activeTab === 'completed') {
      // ✅ TERMINÉES : completed + cancelled + declined
      return userBookings.filter(booking => 
        booking.status === BOOKING_STATUS.COMPLETED ||
        booking.status === BOOKING_STATUS.CANCELLED ||
        booking.status === BOOKING_STATUS.DECLINED
      );
    } else {
      // Toutes les réservations (fallback)
      return userBookings;
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
  
  // Naviguer vers les détails d'une réservation
  const handleViewBooking = (bookingId) => {
    navigation.navigate('BookingDetails', { bookingId });
  };
  
  // Naviguer vers l'écran d'accueil pour créer une nouvelle réservation
  const handleNewBooking = () => {
    navigation.navigate('HomeStack');
  };
  
  // Rendu des réservations
  const renderBookings = () => {
    const filteredBookings = getFilteredBookings();
    
    if (filteredBookings.length === 0) {
      // Messages personnalisés selon l'onglet actif
      let emptyMessage = "";
      if (activeTab === 'pending') {
        emptyMessage = "Vous n'avez pas de réservations en attente.";
      } else if (activeTab === 'confirmed') {
        emptyMessage = "Vous n'avez pas de réservations confirmées.";
      } else if (activeTab === 'completed') {
        emptyMessage = "Vous n'avez pas encore de réservations terminées.";
      }
      
      return (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyCardContent}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
            {activeTab === 'pending' && (
              <Button 
                mode="contained" 
                onPress={handleNewBooking}
                style={styles.newBookingButton}
              >
                Réserver un service
              </Button>
            )}
          </Card.Content>
        </Card>
      );
    }
    
    return filteredBookings.map(booking => (
      <Card 
        key={booking._id} 
        style={styles.bookingCard}
        onPress={() => handleViewBooking(booking._id)}
      >
        <Card.Content>
          <View style={styles.bookingHeader}>
            <Chip 
              style={[styles.statusChip, { backgroundColor: BOOKING_STATUS_COLORS[booking.status] }]}
              textStyle={styles.statusChipText}
            >
              {BOOKING_STATUS_LABELS[booking.status]}
            </Chip>
            <Chip 
              style={[styles.serviceTypeChip, { backgroundColor: getServiceColor(booking.serviceType) }]}
              textStyle={styles.serviceTypeChipText}
            >
              {getServiceTypeLabel(booking.serviceType)}
            </Chip>
          </View>
          
          <Title style={styles.dateTitle}>
            {formatBookingDate(booking.dateTime)}
          </Title>
          
          <View style={styles.bookingDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Heure:</Text>
              <Text style={styles.detailValue}>{formatBookingTime(booking.dateTime)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Durée:</Text>
              <Text style={styles.detailValue}>{booking.duration}h</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Prestataire:</Text>
              <Text style={styles.detailValue}>{booking.selectedProvider?.name || "Non assigné"}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Adresse:</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {booking.address?.name || booking.address?.fullAddress || "Non spécifiée"}
              </Text>
            </View>
          </View>
          
          <Divider style={styles.divider} />
          
          <View style={styles.bookingFooter}>
            <Text style={styles.priceText}>
              {booking.price ? booking.price.toFixed(2) + " ₪" : "--"}
            </Text>
            <Button 
              mode="outlined" 
              onPress={() => handleViewBooking(booking._id)}
              style={[styles.viewButton, { borderColor: getServiceColor(booking.serviceType) }]}
              labelStyle={{ color: getServiceColor(booking.serviceType) }}
            >
              Détails
            </Button>
          </View>
        </Card.Content>
      </Card>
    ));
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mes réservations</Text>
        </View>
      </View>
      
      {/* ✅ NOUVEAUX ONGLETS */}
      <View style={styles.tabsContainer}>
        <Button
          mode={activeTab === 'pending' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('pending')}
          style={[
            styles.tabButton,
            activeTab === 'pending' && styles.activeTabButton
          ]}
          labelStyle={activeTab === 'pending' ? styles.activeTabLabel : styles.tabLabel}
        >
          En attente
        </Button>
        <Button
          mode={activeTab === 'confirmed' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('confirmed')}
          style={[
            styles.tabButton,
            activeTab === 'confirmed' && styles.activeTabButton
          ]}
          labelStyle={activeTab === 'confirmed' ? styles.activeTabLabel : styles.tabLabel}
        >
          Confirmées
        </Button>
        <Button
          mode={activeTab === 'completed' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('completed')}
          style={[
            styles.tabButton,
            activeTab === 'completed' && styles.activeTabButton
          ]}
          labelStyle={activeTab === 'completed' ? styles.activeTabLabel : styles.tabLabel}
        >
          Terminées
        </Button>
      </View>
      
      {isLoadingBookings && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Chargement de vos réservations...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadBookings} />
          }
        >
          {bookingError ? (
            <Card style={styles.errorCard}>
              <Card.Content>
                <Text style={styles.errorText}>{bookingError}</Text>
                <Button 
                  mode="contained" 
                  onPress={loadBookings}
                  style={styles.retryButton}
                >
                  Réessayer
                </Button>
              </Card.Content>
            </Card>
          ) : (
            renderBookings()
          )}
        </ScrollView>
      )}
      
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={handleNewBooking}
        color="white"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2E86C1',
    paddingTop: 40,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'white',
    elevation: 4,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: 20,
  },
  activeTabButton: {
    backgroundColor: '#2196F3',
  },
  tabLabel: {
    fontSize: 12,
  },
  activeTabLabel: {
    fontSize: 12,
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 15,
    paddingBottom: 80, // Espace pour le FAB
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
  errorCard: {
    marginVertical: 10,
    padding: 5,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#c62828',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#c62828',
  },
  emptyCard: {
    marginVertical: 20,
    padding: 10,
    alignItems: 'center',
  },
  emptyCardContent: {
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    color: '#666',
  },
  newBookingButton: {
    backgroundColor: '#2196F3',
  },
  bookingCard: {
    marginVertical: 8,
    borderRadius: 8,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    color: 'white',
    fontSize: 12,
  },
  serviceTypeChip: {
    height: 28,
  },
  serviceTypeChipText: {
    color: 'white',
    fontSize: 12,
  },
  dateTitle: {
    fontSize: 18,
    marginBottom: 10,
    textTransform: 'capitalize', // Pour capitaliser le jour de la semaine
  },
  bookingDetails: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  detailLabel: {
    width: 85,
    fontWeight: 'bold',
    color: '#666',
  },
  detailValue: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewButton: {
    paddingHorizontal: 8,
    height: 36,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
});

export default ClientDashboardScreen;
