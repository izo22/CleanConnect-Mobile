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
        }
      } catch (error) {
      }
    };
    
    loadSavedBookings();
  }, []);

  useEffect(() => {
    if (userBookings.length === 0) {
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
      } catch (error) {
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
      id: provider._id,
      name: `${provider.firstName} ${provider.lastName}`,
      hourlyRate: provider.hourlyRate,
      rating: provider.rating,
    });
    
    setCurrentBooking(prev => ({
      ...prev,
      selectedProvider: provider,
    }));
    
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
      
      
      // Calcul du prix en fonction de la durée
      let price = hourlyRate * currentBooking.duration;
      
      
      // Appliquer des réductions pour les fréquences régulières
      if (currentBooking.frequency === 'weekly') {
        price = price * 0.9; // 10% de réduction
      } else if (currentBooking.frequency === 'bi_weekly') {
        price = price * 0.95; // 5% de réduction
      } else if (currentBooking.frequency === 'monthly') {
        price = price * 0.97; // 3% de réduction
      }
      
      
      // Arrondir à 2 décimales
      price = Math.round(price * 100) / 100;
      
      
      // Simuler un délai réseau
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mettre à jour le prix dans l'état
      updateBooking({ price });
      return price;
    } catch (error) {
      return 0;
    }
  }, [currentBooking.serviceType, currentBooking.duration, currentBooking.frequency, currentBooking.selectedProvider, updateBooking]);

  const syncBookingToProvider = useCallback(async (booking) => {
    try {
      const providerRequestsKey = `provider_requests_${booking.selectedProvider._id}`;
      
      const existingRequests = await AsyncStorage.getItem(providerRequestsKey);
      const requests = existingRequests ? JSON.parse(existingRequests) : [];
      
      
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
      
      await AsyncStorage.setItem(providerRequestsKey, JSON.stringify(requests));
      
    } catch (error) {
    }
  }, [userInfo]);

  const addBooking = useCallback((newBooking) => {
    setUserBookings(prevBookings => {
      const updatedBookings = [newBooking, ...prevBookings];
      return updatedBookings;
    });
    return { success: true, booking: newBooking };
  }, []);

  const createBooking = useCallback(async () => {
    try {
      
      if (!userToken) {
        setBookingError('Veuillez vous connecter pour réserver un service');
        return { success: false, message: 'Authentification requise' };
      }


      if (!currentBooking.serviceType || !currentBooking.selectedProvider || !currentBooking.dateTime) {
        setBookingError('Veuillez remplir tous les champs obligatoires');
        return { success: false, message: 'Informations incomplètes' };
      }

      const bookingId = 'booking-' + Date.now();
      
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
      
      
      const result = addBooking(newBooking);
      
      await syncBookingToProvider(newBooking);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      resetBooking();
      
      return { success: true, booking: newBooking };

    } catch (error) {
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
      
      const savedBookings = await AsyncStorage.getItem(STORAGE_KEYS.USER_BOOKINGS);
      
      if (savedBookings) {
        const bookingsData = JSON.parse(savedBookings);
        
        setUserBookings([...bookingsData]);
        setIsLoadingBookings(false);
        return bookingsData;
      } else {
        setUserBookings([]);
        setIsLoadingBookings(false);
        return [];
      }
    } catch (error) {
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
      return { success: false, message: error.response?.data?.message || 'Erreur lors de l\'annulation' };
    }
  }, []);

  const clearAllBookings = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_BOOKINGS);
      setUserBookings([]);
      return { success: true };
    } catch (error) {
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
