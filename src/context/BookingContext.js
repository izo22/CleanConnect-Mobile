// src/context/BookingContext.js
// ✅ MODIFIÉ - Ajout de la fonction selectProvider

import React, { createContext, useState, useContext, useCallback, useMemo, useEffect } from 'react';
import axios from 'axios';
import { API_URL, SERVICE_TYPES, STORAGE_KEYS } from '../config/constants';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BookingContext = createContext();

export const BookingProvider = ({ children }) => {
  const { userToken, userInfo } = useAuth();
  
  const [currentBooking, setCurrentBooking] = useState({
    serviceType: null,
    selectedProvider: null,
    address: null,
    dateTime: null,
    duration: 2,
    frequency: 'one_time',
    notes: '',
    price: 0,
  });
  
  const [userBookings, setUserBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  useEffect(() => {
    const loadSavedBookings = async () => {
      try {
        const savedBookings = await AsyncStorage.getItem(STORAGE_KEYS.USER_BOOKINGS);
        if (savedBookings) {
          setUserBookings(JSON.parse(savedBookings));
          console.log("Réservations chargées depuis le stockage local:", JSON.parse(savedBookings).length);
        }
      } catch (error) {
        console.log('Erreur lors du chargement des réservations sauvegardées', error);
      }
    };
    
    loadSavedBookings();
  }, []);

  useEffect(() => {
    if (userBookings.length === 0) {
      console.log("Ajout d'une réservation de test");
      const testBooking = {
        _id: 'test-booking-' + Date.now(),
        serviceType: 'home',
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        duration: 2,
        frequency: 'one_time',
        price: 170,
        status: 'pending',
        selectedProvider: {
          _id: 'provider-1',
          name: 'CleanPro Services',
          rating: 4.8,
        },
        address: {
          id: '1',
          name: 'Domicile',
          fullAddress: '123 Rue Principale',
        },
        created: new Date().toISOString(),
      };
      
      setUserBookings([testBooking]);
    }
  }, [userBookings.length]);

  useEffect(() => {
    const saveBookings = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_BOOKINGS, JSON.stringify(userBookings));
        console.log("Réservations sauvegardées dans le stockage local:", userBookings.length);
      } catch (error) {
        console.log('Erreur lors de la sauvegarde des réservations', error);
      }
    };
    
    if (userBookings.length > 0) {
      saveBookings();
    }
  }, [userBookings]);

  const updateBooking = useCallback((data) => {
    setCurrentBooking(prev => ({ ...prev, ...data }));
  }, []);

  // ✅ NOUVELLE FONCTION - Sélectionner un prestataire
  const selectProvider = useCallback((provider) => {
    console.log('✅ Prestataire sélectionné dans le contexte:', provider.firstName, provider.lastName);
    console.log('📊 Données du prestataire:', {
      id: provider._id,
      name: `${provider.firstName} ${provider.lastName}`,
      hourlyRate: provider.hourlyRate,
      rating: provider.rating,
    });
    
    setCurrentBooking(prev => ({
      ...prev,
      selectedProvider: provider,
    }));
    
    console.log('✅ currentBooking mis à jour avec le prestataire');
  }, []);

  const resetBooking = useCallback(() => {
    setCurrentBooking({
      serviceType: null,
      selectedProvider: null,
      address: null,
      dateTime: null,
      duration: 2,
      frequency: 'one_time',
      notes: '',
      price: 0,
    });
  }, []);

  const loadAvailableProviders = useCallback(async (criteria = {}) => {
    try {
      const params = {
        serviceType: criteria.serviceType || currentBooking.serviceType || SERVICE_TYPES.HOME,
        date: criteria.date || (currentBooking.dateTime ? new Date(currentBooking.dateTime).toISOString().split('T')[0] : null),
        location: criteria.location || (currentBooking.address ? currentBooking.address.coordinates : null),
        ...criteria,
      };

      const mockProviders = [
        {
          _id: 'provider-1',
          name: 'CleanPro Services',
          rating: 4.8,
          description: 'Service de nettoyage professionnel pour domiciles',
          services: ['home'],
          price: { home: 85, office: 100 },
          hourlyRate: 85,
          reviewCount: 42,
          availability: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          languages: ['hebrew', 'english', 'french']
        },
        {
          _id: 'provider-2',
          name: 'Office Clean Ltd',
          rating: 4.6,
          description: 'Spécialistes du nettoyage de bureaux et espaces professionnels',
          services: ['office', 'home'],
          price: { office: 90, home: 95 },
          hourlyRate: 90,
          reviewCount: 28,
          availability: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'],
          languages: ['hebrew', 'english']
        },
        {
          _id: 'provider-3',
          name: 'Building Maintenance Co.',
          rating: 4.9,
          description: 'Entretien complet d\'immeubles et de propriétés',
          services: ['building', 'office'],
          price: { building: 120, office: 110 },
          hourlyRate: 120,
          reviewCount: 36,
          availability: ['monday', 'tuesday', 'wednesday', 'thursday', 'sunday'],
          languages: ['hebrew', 'arabic', 'english']
        }
      ];
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return { success: true, providers: mockProviders };
    } catch (error) {
      console.log('Erreur lors du chargement des prestataires disponibles', error);
      setBookingError('Impossible de charger les prestataires disponibles');
      return { success: false, message: error.response?.data?.message || 'Erreur de chargement' };
    }
  }, [currentBooking.serviceType, currentBooking.dateTime, currentBooking.address]);

  // ✅ CALCUL DE PRIX CORRIGÉ - Utilise le tarif réel du prestataire
  const calculatePrice = useCallback(async () => {
    if (!currentBooking.serviceType || !currentBooking.duration) {
      return 0;
    }

    try {
      // ✅ UTILISER LE PRIX DU PRESTATAIRE SÉLECTIONNÉ
      let hourlyRate = 85; // Prix par défaut
      
      if (currentBooking.selectedProvider?.hourlyRate) {
        // Si le prestataire a un tarif horaire global
        hourlyRate = currentBooking.selectedProvider.hourlyRate;
      } else if (currentBooking.selectedProvider?.services) {
        // Si le prestataire a des tarifs par type de service (format nouveau)
        const serviceDetail = currentBooking.selectedProvider.services.find(
          s => s.type === currentBooking.serviceType
        );
        if (serviceDetail && serviceDetail.hourlyRate) {
          hourlyRate = serviceDetail.hourlyRate;
        }
      } else if (currentBooking.selectedProvider?.price) {
        // Ancien format avec objet price
        if (typeof currentBooking.selectedProvider.price === 'object') {
          hourlyRate = currentBooking.selectedProvider.price[currentBooking.serviceType] || 85;
        } else if (typeof currentBooking.selectedProvider.price === 'number') {
          hourlyRate = currentBooking.selectedProvider.price;
        }
      }
      
      console.log('💰 Tarif horaire du prestataire:', hourlyRate);
      console.log('⏱️ Durée:', currentBooking.duration);
      
      // Calcul du prix en fonction de la durée
      let price = hourlyRate * currentBooking.duration;
      
      console.log('💵 Prix avant réduction:', price);
      
      // Appliquer des réductions pour les fréquences régulières
      if (currentBooking.frequency === 'weekly') {
        price = price * 0.9; // 10% de réduction
      } else if (currentBooking.frequency === 'bi_weekly') {
        price = price * 0.95; // 5% de réduction
      } else if (currentBooking.frequency === 'monthly') {
        price = price * 0.97; // 3% de réduction
      }
      
      console.log('💵 Prix après réduction:', price);
      
      // Arrondir à 2 décimales
      price = Math.round(price * 100) / 100;
      
      console.log('✅ Prix final du service:', price);
      
      // Simuler un délai réseau
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mettre à jour le prix dans l'état
      updateBooking({ price });
      return price;
    } catch (error) {
      console.log('Erreur lors du calcul du prix', error);
      return 0;
    }
  }, [currentBooking.serviceType, currentBooking.duration, currentBooking.frequency, currentBooking.selectedProvider, updateBooking]);

  const syncBookingToProvider = useCallback(async (booking) => {
    try {
      console.log("🔵 SYNC - DÉBUT de syncBookingToProvider");
      const providerRequestsKey = `provider_requests_${booking.selectedProvider._id}`;
      console.log("🔵 SYNC - Clé utilisée:", providerRequestsKey);
      console.log("🔵 SYNC - Booking à synchroniser:", booking);
      
      console.log("🔵 SYNC - Lecture AsyncStorage...");
      const existingRequests = await AsyncStorage.getItem(providerRequestsKey);
      const requests = existingRequests ? JSON.parse(existingRequests) : [];
      
      console.log("🔵 SYNC - Demandes existantes:", requests.length);
      
      const providerRequest = {
        _id: booking._id,
        clientId: userInfo?.id || 'current-user-id',
        clientName: userInfo?.name || userInfo?.firstName || 'Client',
        serviceType: booking.serviceType,
        dateTime: booking.dateTime,
        duration: booking.duration,
        status: booking.status,
        price: booking.price,
        address: booking.address,
        notes: booking.notes,
        date: booking.created
      };
      
      requests.unshift(providerRequest);
      console.log("🔵 SYNC - Demande créée:", providerRequest);
      
      console.log("🔵 SYNC - Écriture dans AsyncStorage...");
      await AsyncStorage.setItem(providerRequestsKey, JSON.stringify(requests));
      console.log("🔵 SYNC - Sauvegardé avec succès, total:", requests.length);
      console.log("🔵 SYNC - FIN de syncBookingToProvider ✅");
      
    } catch (error) {
      console.error("🔴 SYNC - Erreur:", error);
      console.error("🔴 SYNC - Stack:", error.stack);
    }
  }, [userInfo]);

  const addBooking = useCallback((newBooking) => {
    console.log("📌 ADD BOOKING - Ajout d'une nouvelle réservation:", newBooking);
    setUserBookings(prevBookings => {
      const updatedBookings = [newBooking, ...prevBookings];
      console.log("📌 ADD BOOKING - Nombre total de réservations après ajout:", updatedBookings.length);
      return updatedBookings;
    });
    return { success: true, booking: newBooking };
  }, []);

  const createBooking = useCallback(async () => {
    try {
      console.log("🔷 ÉTAPE 1 - Début de createBooking");
      console.log("🔷 ÉTAPE 1.1 - userToken:", userToken ? "✅ Présent" : "❌ Absent");
      console.log("🔷 ÉTAPE 1.2 - currentBooking:", JSON.stringify(currentBooking, null, 2));
      
      if (!userToken) {
        console.log("❌ ERREUR - Pas de token d'authentification");
        setBookingError('Veuillez vous connecter pour réserver un service');
        return { success: false, message: 'Authentification requise' };
      }

      console.log("🔷 ÉTAPE 2 - Vérification des données obligatoires");
      console.log("🔷 ÉTAPE 2.1 - serviceType:", currentBooking.serviceType);
      console.log("🔷 ÉTAPE 2.2 - selectedProvider:", currentBooking.selectedProvider);
      console.log("🔷 ÉTAPE 2.3 - dateTime:", currentBooking.dateTime);

      if (!currentBooking.serviceType || !currentBooking.selectedProvider || !currentBooking.dateTime) {
        console.log("❌ ERREUR - Données incomplètes");
        setBookingError('Veuillez remplir tous les champs obligatoires');
        return { success: false, message: 'Informations incomplètes' };
      }

      console.log("🔷 ÉTAPE 3 - Création du booking ID");
      const bookingId = 'booking-' + Date.now();
      console.log("🔷 ÉTAPE 3.1 - ID généré:", bookingId);
      
      console.log("🔷 ÉTAPE 4 - Création de l'objet newBooking");
      const newBooking = {
        _id: bookingId,
        serviceType: currentBooking.serviceType,
        dateTime: currentBooking.dateTime,
        duration: currentBooking.duration,
        frequency: currentBooking.frequency,
        price: currentBooking.price,
        status: 'pending',
        selectedProvider: {
          _id: currentBooking.selectedProvider._id,
          name: currentBooking.selectedProvider.name,
          rating: currentBooking.selectedProvider.rating || 4.8,
        },
        address: currentBooking.address || {
          id: '1',
          name: 'Domicile',
          fullAddress: 'Adresse non spécifiée',
        },
        notes: currentBooking.notes,
        created: new Date().toISOString(),
      };
      
      console.log("🔷 ÉTAPE 4.1 - newBooking créé:", JSON.stringify(newBooking, null, 2));
      
      console.log("🔷 ÉTAPE 5 - Appel de addBooking");
      const result = addBooking(newBooking);
      console.log("🔷 ÉTAPE 5.1 - addBooking terminé, résultat:", result);
      
      console.log("🔷 ÉTAPE 6 - Début de syncBookingToProvider");
      await syncBookingToProvider(newBooking);
      console.log("🔷 ÉTAPE 6.1 - syncBookingToProvider terminé ✅");
      
      console.log("🔷 ÉTAPE 7 - Début du délai de 1 seconde");
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("🔷 ÉTAPE 7.1 - Délai terminé");
      
      console.log("🔷 ÉTAPE 8 - Appel de resetBooking");
      resetBooking();
      console.log("🔷 ÉTAPE 8.1 - resetBooking terminé");
      
      console.log("🔷 ÉTAPE 9 - Retour du succès");
      return { success: true, booking: newBooking };

    } catch (error) {
      console.error('❌ ERREUR FATALE dans createBooking:', error);
      console.error('❌ Stack trace:', error.stack);
      const message = error.response?.data?.message || 'Erreur lors de la création de la réservation';
      setBookingError(message);
      return { success: false, message };
    }
  }, [currentBooking, userToken, resetBooking, addBooking, syncBookingToProvider]);

  const fetchUserBookings = useCallback(async (forceRefresh = false) => {
    if (!userToken) return [];

    setIsLoadingBookings(true);
    setBookingError(null);
    
    try {
      console.log("📱 CLIENT - Chargement des réservations depuis AsyncStorage");
      
      const savedBookings = await AsyncStorage.getItem(STORAGE_KEYS.USER_BOOKINGS);
      
      if (savedBookings) {
        const bookingsData = JSON.parse(savedBookings);
        console.log("📱 CLIENT - Réservations trouvées:", bookingsData.length);
        
        setUserBookings([...bookingsData]);
        setIsLoadingBookings(false);
        return bookingsData;
      } else {
        console.log("📱 CLIENT - Aucune réservation trouvée");
        setUserBookings([]);
        setIsLoadingBookings(false);
        return [];
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des réservations', error);
      setBookingError('Impossible de charger vos réservations');
      setUserBookings([]);
      return [];
    } finally {
      setIsLoadingBookings(false);
    }
  }, [userToken]);

  const updateBookingStatus = useCallback(async (bookingId, status) => {
    try {
      setUserBookings(prev => 
        prev.map(booking => 
          booking._id === bookingId 
            ? { ...booking, status } 
            : booking
        )
      );
      
      const updatedBooking = userBookings.find(booking => booking._id === bookingId);
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      return { success: true, booking: updatedBooking };
    } catch (error) {
      console.log('Erreur lors de la mise à jour du statut', error);
      return { success: false, message: error.response?.data?.message || 'Erreur de mise à jour' };
    }
  }, [userBookings]);

  const cancelBooking = useCallback(async (bookingId) => {
    try {
      setUserBookings(prev => 
        prev.map(booking => 
          booking._id === bookingId 
            ? { ...booking, status: 'cancelled' } 
            : booking
        )
      );
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      return { success: true };
    } catch (error) {
      console.log('Erreur lors de l\'annulation', error);
      return { success: false, message: error.response?.data?.message || 'Erreur lors de l\'annulation' };
    }
  }, []);

  const clearAllBookings = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_BOOKINGS);
      setUserBookings([]);
      console.log("Toutes les réservations ont été effacées");
      return { success: true };
    } catch (error) {
      console.log('Erreur lors de la suppression des réservations', error);
      return { success: false, message: 'Erreur lors de la suppression des réservations' };
    }
  }, []);

  const contextValue = useMemo(() => ({
    currentBooking,
    updateBooking,
    selectProvider, // ✅ AJOUTÉ - Fonction pour sélectionner un prestataire
    resetBooking,
    loadAvailableProviders,
    calculatePrice,
    createBooking,
    fetchUserBookings,
    updateBookingStatus,
    cancelBooking,
    userBookings,
    isLoadingBookings,
    bookingError,
    addBooking,
    clearAllBookings,
    syncBookingToProvider,
  }), [
    currentBooking,
    updateBooking,
    selectProvider, // ✅ AJOUTÉ dans les dépendances
    resetBooking,
    loadAvailableProviders,
    calculatePrice,
    createBooking,
    fetchUserBookings,
    updateBookingStatus,
    cancelBooking,
    userBookings,
    isLoadingBookings,
    bookingError,
    addBooking,
    clearAllBookings,
    syncBookingToProvider,
  ]);

  return (
    <BookingContext.Provider value={contextValue}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  
  if (context === undefined) {
    throw new Error('useBooking doit être utilisé dans un BookingProvider');
  }
  
  return context;
};